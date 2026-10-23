import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { findAvailableSlots } from "../graph";
import { logger } from "../logger";
import { normalizePhone, maskPhone } from "../phone";
import { formatGermanDateTime } from "../time";
import { assessUrgency } from "../urgency";
import { URGENCIES, CUSTOMER_TYPES } from "../constants";
import { findCustomerByPhone, upsertCustomer } from "../services/customers";
import { processServiceRequest, routeRequest } from "../services/tickets";

/**
 * Function-Calling-Werkzeuge der Sprach-KI. Rückgaben sind bewusst kurz und
 * enthalten ein Feld `say` – eine natürlichsprachliche Formulierung, die der
 * Agent direkt verwenden kann.
 */

const phoneArg = z.string().optional();
const urgencyArg = z.enum(URGENCIES).optional().catch(undefined);
const customerTypeArg = z.enum(CUSTOMER_TYPES).optional().catch(undefined);

const schemas = {
  identify_caller: z.object({ phone: phoneArg }),
  save_customer: z.object({
    phone: phoneArg,
    name: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    customerType: customerTypeArg,
  }),
  find_technician: z.object({
    phone: phoneArg,
    postalCode: z.string().optional(),
    pestType: z.string().optional(),
    description: z.string().optional(),
    urgency: urgencyArg,
    customerType: customerTypeArg,
  }),
  book_appointment: z.object({
    phone: phoneArg,
    pestType: z.string().optional(),
    description: z.string().min(1),
    urgency: urgencyArg,
    appointmentStart: z.string().optional(),
    employeeId: z.string().optional(),
    name: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    customerType: customerTypeArg,
  }),
  escalate_emergency: z.object({
    phone: phoneArg,
    pestType: z.string().optional(),
    description: z.string().min(1),
    postalCode: z.string().optional(),
    address: z.string().optional(),
    name: z.string().optional(),
  }),
} as const;

export type ToolName = keyof typeof schemas;
export const TOOL_NAMES = Object.keys(schemas) as ToolName[];

type Ctx = { callerNumber: string | null };

function resolvePhone(argPhone: string | undefined, ctx: Ctx): string {
  const p = normalizePhone(argPhone) ?? normalizePhone(ctx.callerNumber);
  if (!p) throw new ToolError("Keine gültige Rufnummer vorhanden. Bitte die Rückrufnummer erfragen.");
  return p;
}

export class ToolError extends Error {}

const handlers: { [K in ToolName]: (args: z.infer<(typeof schemas)[K]>, ctx: Ctx) => Promise<unknown> } = {
  async identify_caller(args, ctx) {
    const phone = normalizePhone(args.phone) ?? normalizePhone(ctx.callerNumber);
    if (!phone) return { status: "UNKNOWN", say: "Die Rufnummer ist unterdrückt. Bitte nach Name und Rückrufnummer fragen." };
    const c = await findCustomerByPhone(phone);
    if (!c) return { status: "NEW", phone, say: "Neukunde. Bitte Name, Adresse mit Postleitzahl und Anliegen erfragen." };
    return {
      status: c.status,
      phone,
      customerId: c.id,
      name: c.name,
      companyName: c.companyName,
      customerType: c.customerType,
      address: c.address,
      postalCode: c.postalCode,
      hasEmail: !!c.email,
      recentTickets: c.tickets.map((t) => ({
        date: t.createdAt.toISOString().slice(0, 10),
        pestType: t.pestType,
        status: t.status,
        technician: t.assignedEmployee?.name ?? null,
      })),
      say: c.name
        ? `Bestandskunde ${c.name}${c.companyName ? ` (${c.companyName})` : ""}. Adresse ${c.address ?? "unbekannt"} kurz bestätigen lassen.`
        : "Bekannte Nummer ohne Namen. Bitte Namen erfragen.",
    };
  },

  async save_customer(args, ctx) {
    const phone = resolvePhone(args.phone, ctx);
    const c = await upsertCustomer({ ...args, phone });
    return { ok: true, customerId: c.id, status: c.status, postalCode: c.postalCode, emailSaved: !!c.email };
  },

  async find_technician(args, ctx) {
    const phone = normalizePhone(args.phone) ?? normalizePhone(ctx.callerNumber);
    const existing = phone ? await prisma.customer.findUnique({ where: { phone } }) : null;
    const postalCode = args.postalCode ?? existing?.postalCode ?? null;
    const customerType = args.customerType ?? existing?.customerType ?? "PRIVATE";
    const urgency = assessUrgency({ pestType: args.pestType, description: args.description, customerType, aiUrgency: args.urgency ?? null });
    const routing = await routeRequest({ postalCode, urgency, customerType, pestType: args.pestType });
    if (!routing.employee) return { found: false, urgency, say: "Aktuell ist kein Techniker hinterlegt. Bitte Rückruf anbieten." };

    let slots: { start: string; label: string }[] = [];
    let calendarError: string | null = null;
    if (routing.employee.role !== "BACKOFFICE") {
      try {
        const free = await findAvailableSlots(routing.employee.microsoftUpn, { urgent: urgency === "HIGH" || urgency === "CRITICAL", max: 3 });
        slots = free.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, env().BUSINESS_TIMEZONE) }));
      } catch (err) {
        calendarError = (err as Error).message;
        logger.error("tool.slots_failed", { error: calendarError });
      }
    }

    return {
      found: true,
      urgency,
      employeeId: routing.employee.id,
      technician: routing.employee.name,
      role: routing.employee.role,
      areaMatch: routing.areaMatch,
      transferRecommended: routing.transferRecommended,
      transferNumber: routing.transferRecommended ? routing.employee.directPhone : null,
      slots,
      reason: routing.reason,
      say:
        urgency === "CRITICAL"
          ? `Notfall. ${routing.transferRecommended ? `Anrufer jetzt an ${routing.employee.name} durchstellen.` : "Notfall-Ticket mit escalate_emergency anlegen."}`
          : slots.length
            ? `Zuständig ist ${routing.employee.name}. Freie Termine: ${slots.map((s) => s.label).join("; ")}.`
            : `Zuständig ist ${routing.employee.name}. Keine freien Termine gefunden – Rückruf zur Terminabstimmung anbieten.`,
      ...(calendarError ? { calendarError: "Kalender nicht erreichbar" } : {}),
    };
  },

  async book_appointment(args, ctx) {
    const phone = resolvePhone(args.phone, ctx);
    const res = await processServiceRequest({
      customer: { phone, name: args.name, companyName: args.companyName, email: args.email, address: args.address, postalCode: args.postalCode, customerType: args.customerType },
      pestType: args.pestType,
      description: args.description,
      urgency: args.urgency,
      appointmentStart: args.appointmentStart,
      employeeId: args.employeeId,
    });
    const tz = env().BUSINESS_TIMEZONE;
    const tech = res.ticket.assignedEmployee?.name;
    return {
      ok: true,
      ticketId: res.ticket.id,
      urgency: res.ticket.urgency,
      technician: tech ?? null,
      appointment: res.appointment ? res.appointment.start.toISOString() : null,
      calendarSynced: res.outlook.eventCreated,
      emailDraftCreated: res.outlook.draftCreated,
      say: res.appointment
        ? `Termin am ${formatGermanDateTime(res.appointment.start, tz)}${tech ? ` mit ${tech}` : ""} ist eingetragen.` +
          (res.ticket.customer.email ? " Eine Bestätigung folgt per E-Mail." : "")
        : `Anliegen ist aufgenommen${tech ? `, ${tech} meldet sich` : ", wir melden uns"} zur Terminabstimmung.`,
    };
  },

  async escalate_emergency(args, ctx) {
    const phone = resolvePhone(args.phone, ctx);
    const res = await processServiceRequest({
      customer: { phone, name: args.name, address: args.address, postalCode: args.postalCode },
      pestType: args.pestType,
      description: args.description,
      escalate: true,
    });
    const emp = res.ticket.assignedEmployee;
    const fallback = env().BACKOFFICE_FALLBACK_NUMBER ?? null;
    const transferNumber = emp?.directPhone ?? fallback;
    return {
      ok: true,
      ticketId: res.ticket.id,
      technician: emp?.name ?? null,
      transferNumber,
      say: transferNumber
        ? `Notfall-Ticket angelegt. Bitte jetzt mit transfer_call an ${transferNumber} durchstellen.`
        : `Notfall-Ticket angelegt. ${emp?.name ?? "Der Notdienst"} ruft innerhalb von 15 Minuten zurück.`,
    };
  },
};

export async function runTool(name: string, rawArgs: Record<string, unknown>, ctx: Ctx): Promise<unknown> {
  if (!(name in schemas)) return { error: `Unbekanntes Werkzeug: ${name}` };
  const tool = name as ToolName;
  const parsed = schemas[tool].safeParse(rawArgs);
  if (!parsed.success) {
    return { error: "Ungültige Parameter", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const started = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (handlers[tool] as (a: any, c: Ctx) => Promise<unknown>)(parsed.data, ctx);
    logger.info("tool.ok", { tool, ms: Date.now() - started, caller: ctx.callerNumber ? maskPhone(ctx.callerNumber) : null });
    return result;
  } catch (err) {
    logger.error("tool.failed", { tool, error: (err as Error).message });
    if (err instanceof ToolError) return { error: err.message };
    return { error: "Interner Fehler. Bitte Anliegen notieren und Rückruf durch das Büro anbieten." };
  }
}
