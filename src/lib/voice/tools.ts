import { z } from "zod";
import { prisma } from "../db";
import { findAvailableSlots } from "../calendar";
import { logger } from "../logger";
import { normalizePhone, maskPhone } from "../phone";
import { formatGermanDateTime } from "../time";
import { assessUrgency } from "../urgency";
import { URGENCIES, CUSTOMER_TYPES } from "../constants";
import { findCustomerByPhone, upsertCustomer } from "../services/customers";
import { processServiceRequest, routeRequest } from "../services/tickets";
import type { VoiceCallContext } from "./context";

/**
 * Function-Calling-Werkzeuge der Sprach-KI. Jede Rückgabe enthält `say` –
 * eine Formulierung, die der Agent direkt nutzen kann. Der Mandant kommt
 * immer aus dem Anrufkontext, nie aus den Argumenten.
 */
const phoneArg = z.string().optional();
const urgencyArg = z.enum(URGENCIES).optional().catch(undefined);
const customerTypeArg = z.enum(CUSTOMER_TYPES).optional().catch(undefined);
// Abwärtskompatibel: frühere Prompt-Version nutzte "pestType"
const withCategory = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, category: z.string().optional(), pestType: z.string().optional() }).transform(({ pestType, ...r }) => ({ ...r, category: r.category ?? pestType }));

const customerFields = {
  name: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  customerType: customerTypeArg,
};

const schemas = {
  identify_caller: z.object({ phone: phoneArg }),
  save_customer: z.object({ phone: phoneArg, ...customerFields }),
  find_technician: withCategory({ phone: phoneArg, postalCode: z.string().optional(), description: z.string().optional(), urgency: urgencyArg, customerType: customerTypeArg }),
  book_appointment: withCategory({ phone: phoneArg, description: z.string().min(1), urgency: urgencyArg, appointmentStart: z.string().optional(), employeeId: z.string().optional(), ...customerFields }),
  escalate_emergency: withCategory({ phone: phoneArg, description: z.string().min(1), postalCode: z.string().optional(), address: z.string().optional(), name: z.string().optional() }),
} as const;

export type ToolName = keyof typeof schemas;
export const TOOL_NAMES = Object.keys(schemas) as ToolName[];

export class ToolError extends Error {}

function resolvePhone(argPhone: string | undefined, ctx: VoiceCallContext): string {
  const p = normalizePhone(argPhone) ?? normalizePhone(ctx.callerNumber);
  if (!p) throw new ToolError("Keine gültige Rufnummer vorhanden. Bitte die Rückrufnummer erfragen.");
  return p;
}

type Handler<K extends ToolName> = (args: z.infer<(typeof schemas)[K]>, ctx: VoiceCallContext) => Promise<unknown>;

const handlers: { [K in ToolName]: Handler<K> } = {
  async identify_caller(args, ctx) {
    const phone = normalizePhone(args.phone) ?? normalizePhone(ctx.callerNumber);
    if (!phone) return { status: "UNKNOWN", say: "Die Rufnummer ist unterdrückt. Bitte nach Name und Rückrufnummer fragen." };
    const c = await findCustomerByPhone(ctx.tenant.id, phone);
    if (!c) return { status: "NEW", phone, say: "Neukunde. Bitte Name, Adresse mit Postleitzahl und Anliegen erfragen." };
    return {
      status: c.status, phone, name: c.name, companyName: c.companyName, customerType: c.customerType,
      address: c.address, postalCode: c.postalCode, hasEmail: !!c.email,
      recentTickets: c.tickets.map((t) => ({ date: t.createdAt.toISOString().slice(0, 10), category: t.category, status: t.status, employee: t.assignedEmployee?.name ?? null })),
      say: c.name ? `Bestandskunde ${c.name}${c.companyName ? ` (${c.companyName})` : ""}. Adresse ${c.address ?? "unbekannt"} kurz bestätigen lassen.` : "Bekannte Nummer ohne Namen. Bitte Namen erfragen.",
    };
  },

  async save_customer(args, ctx) {
    const c = await upsertCustomer(ctx.tenant.id, { ...args, phone: resolvePhone(args.phone, ctx) });
    if (ctx.callRowId) await prisma.call.update({ where: { id: ctx.callRowId }, data: { customerId: c.id } });
    return { ok: true, status: c.status, postalCode: c.postalCode, emailSaved: !!c.email };
  },

  async find_technician(args, ctx) {
    const phone = normalizePhone(args.phone) ?? normalizePhone(ctx.callerNumber);
    const existing = phone ? await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId: ctx.tenant.id, phone } } }) : null;
    const postalCode = args.postalCode ?? existing?.postalCode ?? null;
    const customerType = args.customerType ?? existing?.customerType ?? "PRIVATE";
    const urgency = assessUrgency({ category: args.category, description: args.description, customerType, aiUrgency: args.urgency ?? null, rules: ctx.cfg.urgencyRules });
    const routing = await routeRequest(ctx.tenant.id, ctx.cfg, { postalCode, urgency, customerType, category: args.category });
    if (!routing.employee) return { found: false, urgency, say: "Aktuell ist niemand eingeplant. Bitte Rückruf anbieten (book_appointment ohne Termin)." };

    const emergencyNumber = routing.employee.directPhone ?? (ctx.cfg.settings.emergency.transferNumber || null);
    if (urgency === "CRITICAL" && ctx.cfg.settings.emergency.enabled) {
      return { found: true, urgency, employeeId: routing.employee.id, employee: routing.employee.name, transferNumber: emergencyNumber, slots: [], say: "Notfall. Sofort escalate_emergency aufrufen und danach durchstellen." };
    }

    let slots: { start: string; label: string }[] = [];
    let calendarError: string | null = null;
    if (routing.employee.role !== "BACKOFFICE") {
      const r = await findAvailableSlots(ctx.tenant, ctx.cfg, routing.employee, { urgent: urgency === "HIGH" });
      slots = r.slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, ctx.tenant.timezone) }));
      calendarError = r.calendarError;
    }
    return {
      found: true, urgency, employeeId: routing.employee.id, employee: routing.employee.name, areaMatch: routing.areaMatch, slots, reason: routing.reason,
      say: slots.length
        ? `Zuständig ist ${routing.employee.name}. Freie Termine: ${slots.map((s) => s.label).join("; ")}.`
        : `Zuständig ist ${routing.employee.name}. Keine freien Termine gefunden – Rückruf zur Terminabstimmung anbieten.`,
      ...(calendarError ? { calendarWarning: calendarError } : {}),
    };
  },

  async book_appointment(args, ctx) {
    const phone = resolvePhone(args.phone, ctx);
    const res = await processServiceRequest(ctx.tenant, ctx.cfg, {
      customer: { phone, name: args.name, companyName: args.companyName, email: args.email, address: args.address, postalCode: args.postalCode, customerType: args.customerType },
      category: args.category, description: args.description, urgency: args.urgency, appointmentStart: args.appointmentStart, employeeId: args.employeeId, callId: ctx.callRowId,
    });
    const tz = ctx.tenant.timezone;
    const emp = res.ticket.assignedEmployee?.name;
    if (res.slotTaken) {
      const r = res.ticket.assignedEmployee ? await findAvailableSlots(ctx.tenant, ctx.cfg, res.ticket.assignedEmployee) : { slots: [] };
      const slots = r.slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, tz) }));
      return { ok: false, slotTaken: true, slots, say: `Dieser Termin wurde gerade vergeben. ${slots.length ? `Alternativen: ${slots.map((s) => s.label).join("; ")}.` : "Bitte Rückruf anbieten."}` };
    }
    const confirmParts = [...res.notify.customer].filter((x) => x.includes("SENT") || x.includes("Entwurf"));
    return {
      ok: true, reference: res.ticket.id.slice(-8).toUpperCase(), urgency: res.ticket.urgency, employee: emp ?? null,
      appointment: res.appointment ? res.appointment.start.toISOString() : null,
      say: res.appointment
        ? `Termin am ${formatGermanDateTime(res.appointment.start, tz)}${emp ? ` mit ${emp}` : ""} ist eingetragen.${confirmParts.length ? " Eine Bestätigung folgt." : ""}`
        : `Anliegen ist aufgenommen${emp ? `, ${emp} meldet sich` : ", wir melden uns"} zur Terminabstimmung.`,
    };
  },

  async escalate_emergency(args, ctx) {
    const phone = resolvePhone(args.phone, ctx);
    const res = await processServiceRequest(ctx.tenant, ctx.cfg, {
      customer: { phone, name: args.name, address: args.address, postalCode: args.postalCode },
      category: args.category, description: args.description, escalate: true, callId: ctx.callRowId,
    });
    const emp = res.ticket.assignedEmployee;
    const transferNumber = emp?.directPhone ?? (ctx.cfg.settings.emergency.transferNumber || null);
    return {
      ok: true, reference: res.ticket.id.slice(-8).toUpperCase(), employee: emp?.name ?? null, transferNumber,
      say: transferNumber
        ? `Notfall ist aufgenommen. Jetzt mit transfer_call an ${transferNumber} durchstellen.`
        : `Notfall ist aufgenommen. ${emp?.name ?? "Der Notdienst"} ruft schnellstmöglich zurück.`,
    };
  },
};

export async function runTool(name: string, rawArgs: Record<string, unknown>, ctx: VoiceCallContext): Promise<unknown> {
  if (!(name in schemas)) return { error: `Unbekanntes Werkzeug: ${name}` };
  const tool = name as ToolName;
  const parsed = schemas[tool].safeParse(rawArgs);
  if (!parsed.success) return { error: "Ungültige Parameter", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const started = Date.now();
  try {
    const result = await (handlers[tool] as Handler<ToolName>)(parsed.data as never, ctx);
    logger.info("tool.ok", { tenantId: ctx.tenant.id, tool, ms: Date.now() - started, caller: ctx.callerNumber ? maskPhone(ctx.callerNumber) : null });
    return result;
  } catch (err) {
    logger.error("tool.failed", { tenantId: ctx.tenant.id, tool, error: (err as Error).message });
    if (err instanceof ToolError) return { error: err.message };
    return { error: "Interner Fehler. Bitte Anliegen notieren und Rückruf durch das Büro anbieten." };
  }
}
