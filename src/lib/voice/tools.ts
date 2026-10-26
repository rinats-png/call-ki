import { z } from "zod";
import { prisma } from "../db";
import { findAvailableSlots } from "../calendar";
import { locate, travelEnabled, travelFeeFor } from "../services/travel";
import { cfgForService, serviceForCategory } from "../services/catalog";
import { logger } from "../logger";
import { normalizePhone, maskPhone } from "../phone";
import { scheduleServerTransfer } from "./transfer";
import { smsDestinationAllowed } from "../notify";
import { formatGermanDateTime } from "../time";
import { assessUrgency } from "../urgency";
import { URGENCIES, CUSTOMER_TYPES } from "../constants";
import { findCustomerByPhone, upsertCustomer } from "../services/customers";
import { cancelAppointment, processServiceRequest, rescheduleAppointment, routeRequest } from "../services/tickets";
import { hasFeature, planForTenant } from "../billing";
import type { VoiceCallContext } from "./context";

/**
 * Function-Calling-Werkzeuge der Sprach-KI. Jede Rückgabe enthält `say` –
 * eine Formulierung, die der Agent direkt nutzen kann. Der Mandant kommt
 * immer aus dem Anrufkontext, nie aus den Argumenten.
 */
const phoneArg = z.string().optional();
const urgencyArg = z.enum(URGENCIES).optional().catch(undefined);
// Alte Agenten-Konfigurationen schicken noch "B2B_HACCP" – gilt als Gewerbekunde
const customerTypeArg = z.preprocess((v) => (v === "B2B_HACCP" ? "BUSINESS" : v), z.enum(CUSTOMER_TYPES).optional()).catch(undefined);
// Abwärtskompatibel: frühere Prompt-Version nutzte "pestType"
const withCategory = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, category: z.string().optional(), pestType: z.string().optional() }).transform((v) => {
    const { pestType, category, ...r } = v as z.infer<z.ZodObject<T>> & { category?: string; pestType?: string };
    return { ...r, category: category ?? pestType };
  });

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
  save_customer: z.object({ phone: phoneArg, ...customerFields, smsConsent: z.boolean().optional() }),
  find_technician: withCategory({ phone: phoneArg, postalCode: z.string().optional(), description: z.string().optional(), urgency: urgencyArg, customerType: customerTypeArg }),
  book_appointment: withCategory({ phone: phoneArg, description: z.string().min(1), urgency: urgencyArg, appointmentStart: z.string().optional(), employeeId: z.string().optional(), ...customerFields }),
  escalate_emergency: withCategory({ phone: phoneArg, description: z.string().min(1), postalCode: z.string().optional(), address: z.string().optional(), name: z.string().optional() }),
  find_appointments: z.object({}).passthrough(),
  recording_consent: z.object({ granted: z.boolean() }),
  reschedule_appointment: z.object({ reference: z.string().max(40).optional(), appointmentStart: z.string().optional() }),
  cancel_appointment: z.object({ reference: z.string().max(40).optional(), reason: z.string().max(300).optional() }),
} as const;

export type ToolName = keyof typeof schemas;
export const TOOL_NAMES = Object.keys(schemas) as ToolName[];

export class ToolError extends Error {}

/**
 * Rückrufnummer des Kunden. Nur die vom Anbieter bzw. von Twilio gemeldete Anrufernummer
 * ist verifiziert; eine genannte Nummer kann zu einer fremden Person gehören.
 */
function resolvePhone(argPhone: string | undefined, ctx: VoiceCallContext): { phone: string; verified: boolean } {
  const caller = normalizePhone(ctx.callerNumber);
  const p = normalizePhone(argPhone) ?? caller;
  if (!p) throw new ToolError("Keine gültige Rufnummer vorhanden. Bitte die Rückrufnummer erfragen.");
  return { phone: p, verified: p === caller };
}

/**
 * Kommende Termine des Anrufers – ausschließlich zur verifizierten Anrufernummer
 * (keine Termine Dritter über genannte Nummern oder Vorgangsnummern).
 */
async function callerAppointments(ctx: VoiceCallContext) {
  const phone = normalizePhone(ctx.callerNumber);
  if (!phone) return null;
  return prisma.callTicket.findMany({
    where: { tenantId: ctx.tenant.id, customer: { phone }, appointmentStart: { gt: new Date() }, status: { not: "CLOSED" } },
    include: { customer: true, assignedEmployee: true },
    orderBy: { appointmentStart: "asc" },
    take: 5,
  });
}
const NO_VERIFIED_NUMBER = { found: false, say: "Termine kann ich nur ändern, wenn Sie von der Nummer anrufen, mit der der Termin vereinbart wurde. Bitte Rückruf durch das Büro anbieten." };
const ref = (id: string) => id.slice(-8).toUpperCase();

/** Termin des Anrufers zur Vorgangsnummer; ohne Nummer nur, wenn es genau einen kommenden Termin gibt. */
async function pickAppointment(ctx: VoiceCallContext, reference: string | undefined) {
  const list = await callerAppointments(ctx);
  if (!list) return { error: NO_VERIFIED_NUMBER } as const;
  const clean = (reference ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const hit = clean ? list.find((t) => ref(t.id) === clean || ref(t.id).endsWith(clean)) : list.length === 1 ? list[0] : undefined;
  if (!hit) return { error: { found: false, appointments: list.map((t) => ({ reference: ref(t.id), label: formatGermanDateTime(t.appointmentStart!, ctx.tenant.timezone) })), say: list.length ? "Welcher Termin ist gemeint? Bitte Datum nennen lassen und die Vorgangsnummer übergeben." : "Zu dieser Rufnummer gibt es keinen kommenden Termin." } } as const;
  return { ticket: hit } as const;
}

type Handler<K extends ToolName> = (args: z.infer<(typeof schemas)[K]>, ctx: VoiceCallContext) => Promise<unknown>;

const handlers: { [K in ToolName]: Handler<K> } = {
  // Kundendaten nur zur verifizierten Anrufernummer – eine genannte Nummer (args.phone) wird ignoriert,
  // sonst könnte jeder Anrufer Name, Adresse und Aufträge fremder Kunden abfragen.
  async identify_caller(_args, ctx) {
    const phone = normalizePhone(ctx.callerNumber);
    if (!phone) return { status: "UNKNOWN", say: "Die Rufnummer ist unterdrückt. Kundendaten gibt es nur zur Anrufernummer. Bitte Name, Adresse und Rückrufnummer erfragen." };
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
    const { phone, verified } = resolvePhone(args.phone, ctx);
    const { smsConsent, ...fields } = args;
    const c = await upsertCustomer(ctx.tenant.id, { ...fields, phone, onlyFillMissing: !verified });
    // SMS-Einwilligung nur für die eigene (verifizierte) Nummer festhalten
    if (smsConsent === true && verified) await prisma.customer.update({ where: { id: c.id }, data: { smsConsentAt: new Date(), smsConsentSource: ctx.callRowId ? `call:${ctx.callRowId}` : "call", smsOptOutAt: null } });
    if (smsConsent === false && verified) await prisma.customer.update({ where: { id: c.id }, data: { smsOptOutAt: new Date() } });
    if (ctx.callRowId) await prisma.call.update({ where: { id: ctx.callRowId }, data: { customerId: c.id } });
    // Zu einer nicht verifizierten Nummer keine gespeicherten Angaben zurückmelden
    return verified ? { ok: true, status: c.status, postalCode: c.postalCode, emailSaved: !!c.email } : { ok: true };
  },

  async find_technician(args, ctx) {
    const phone = normalizePhone(ctx.callerNumber);
    const existing = phone ? await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId: ctx.tenant.id, phone } } }) : null;
    const postalCode = args.postalCode ?? existing?.postalCode ?? null;
    const customerType = args.customerType ?? existing?.customerType ?? "PRIVATE";
    const urgency = assessUrgency({ category: args.category, description: args.description, customerType, aiUrgency: args.urgency ?? null, rules: ctx.cfg.urgencyRules });
    const service = await serviceForCategory(ctx.tenant.id, args.category);
    const cfg = cfgForService(ctx.cfg, service);
    // Einsatzplanung: Fahrzeit zum Einsatzort (genannte Adresse, sonst gespeicherte)
    const target = (await travelEnabled(ctx.tenant.id, cfg)) ? await locate({ address: existing?.address, postalCode }) : null;
    const routing = await routeRequest(ctx.tenant.id, cfg, { postalCode, urgency, customerType, category: args.category, trade: service?.trade || null, target });
    if (!routing.employee) return { found: false, urgency, say: "Aktuell ist niemand eingeplant. Bitte Rückruf anbieten (book_appointment ohne Termin)." };

    const plan = (await planForTenant(ctx.tenant.id)).plan;
    const forwarding = hasFeature(plan, "emergency_forwarding");
    const emergencyNumber = forwarding ? routing.employee.directPhone ?? (ctx.cfg.settings.emergency.transferNumber || null) : null;
    if (urgency === "CRITICAL" && ctx.cfg.settings.emergency.enabled) {
      return { found: true, urgency, employeeId: routing.employee.id, employee: routing.employee.name, transferNumber: emergencyNumber, slots: [], say: emergencyNumber ? "Notfall. Sofort escalate_emergency aufrufen und danach durchstellen." : "Notfall. Sofort escalate_emergency aufrufen; der Notdienst ruft schnellstmöglich zurück." };
    }
    // Ohne Terminbuchung im Paket: nur Rückruf zur Terminabstimmung
    if (!hasFeature(plan, "calendar_internal")) {
      return { found: true, urgency, employeeId: routing.employee.id, employee: routing.employee.name, areaMatch: routing.areaMatch, slots: [], reason: routing.reason, say: `Zuständig ist ${routing.employee.name}. Termine vergibt das Büro – Rückruf zur Terminabstimmung anbieten (book_appointment ohne Termin).` };
    }

    let slots: { start: string; label: string }[] = [];
    let calendarError: string | null = null;
    if (routing.employee.role !== "BACKOFFICE") {
      const r = await findAvailableSlots(ctx.tenant, cfg, routing.employee, { urgent: urgency === "HIGH", target });
      slots = r.slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, ctx.tenant.timezone) }));
      calendarError = r.calendarError;
    }
    const fee = await travelFeeFor(ctx.tenant.id, cfg, routing.employee, target);
    const feeNote = fee ? ` Hinweis an den Kunden: Für diese Entfernung berechnen wir eine Anfahrtspauschale von ${(fee.cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} netto.` : "";
    return {
      found: true, urgency, employeeId: routing.employee.id, employee: routing.employee.name, areaMatch: routing.areaMatch, slots, reason: routing.reason,
      ...(fee ? { travelFeeCents: fee.cents } : {}),
      say: (slots.length
        ? `Zuständig ist ${routing.employee.name}. Freie Termine: ${slots.map((s) => s.label).join("; ")}.`
        : `Zuständig ist ${routing.employee.name}. Keine freien Termine gefunden – Rückruf zur Terminabstimmung anbieten.`) + feeNote,
      ...(calendarError ? { calendarWarning: calendarError } : {}),
    };
  },

  async book_appointment(args, ctx) {
    const { phone, verified } = resolvePhone(args.phone, ctx);
    // Ohne Terminbuchung im Paket wird kein Termin eingetragen, nur der Vorgang angelegt
    if (args.appointmentStart && !hasFeature((await planForTenant(ctx.tenant.id)).plan, "calendar_internal")) args = { ...args, appointmentStart: undefined };
    const res = await processServiceRequest(ctx.tenant, ctx.cfg, {
      customer: { phone, onlyFillMissing: !verified, name: args.name, companyName: args.companyName, email: args.email, address: args.address, postalCode: args.postalCode, customerType: args.customerType },
      category: args.category, description: args.description, urgency: args.urgency, appointmentStart: args.appointmentStart, employeeId: args.employeeId, callId: ctx.callRowId,
      deferNotify: true,
    });
    const tz = ctx.tenant.timezone;
    const emp = res.ticket.assignedEmployee?.name;
    if (res.slotTaken) {
      const r = res.ticket.assignedEmployee ? await findAvailableSlots(ctx.tenant, cfgForService(ctx.cfg, await serviceForCategory(ctx.tenant.id, args.category)), res.ticket.assignedEmployee, { target: (await travelEnabled(ctx.tenant.id, ctx.cfg)) ? await locate(res.ticket.customer) : null }) : { slots: [] };
      const slots = r.slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, tz) }));
      return { ok: false, slotTaken: true, slots, say: `Dieser Termin wurde gerade vergeben. ${slots.length ? `Alternativen: ${slots.map((s) => s.label).join("; ")}.` : "Bitte Rückruf anbieten."}` };
    }
    const confirmFollows = res.notify.deferred ? !!res.notify.confirmationPlanned : res.notify.customer.some((x) => x.includes("SENT") || x.includes("Entwurf"));
    return {
      ok: true, reference: res.ticket.id.slice(-8).toUpperCase(), urgency: res.ticket.urgency, employee: emp ?? null,
      appointment: res.appointment ? res.appointment.start.toISOString() : null,
      say: res.appointment
        ? `Termin am ${formatGermanDateTime(res.appointment.start, tz)}${emp ? ` mit ${emp}` : ""} ist eingetragen.${confirmFollows ? " Eine Bestätigung folgt." : ""}`
        : `Anliegen ist aufgenommen${emp ? `, ${emp} meldet sich` : ", wir melden uns"} zur Terminabstimmung.`,
    };
  },

  async escalate_emergency(args, ctx) {
    const { phone, verified } = resolvePhone(args.phone, ctx);
    const res = await processServiceRequest(ctx.tenant, ctx.cfg, {
      customer: { phone, onlyFillMissing: !verified, name: args.name, address: args.address, postalCode: args.postalCode },
      category: args.category, description: args.description, escalate: true, callId: ctx.callRowId,
      deferNotify: true,
    });
    const emp = res.ticket.assignedEmployee;
    const forwarding = hasFeature((await planForTenant(ctx.tenant.id)).plan, "emergency_forwarding");
    const configured = forwarding ? emp?.directPhone ?? (ctx.cfg.settings.emergency.transferNumber || null) : null;
    // Nur in freigegebene Länder durchstellen (Toll-Fraud-Schutz, SMS_ALLOWED_PREFIXES)
    const target = configured && smsDestinationAllowed(configured) ? configured : null;
    // Bevorzugt: Twilio stellt durch (Ziel nur aus unseren Daten). Sonst transfer_call des Anbieters.
    if (target && (await scheduleServerTransfer(ctx.callRowId, target))) {
      return {
        ok: true, reference: res.ticket.id.slice(-8).toUpperCase(), employee: emp?.name ?? null, transferNumber: null, transferring: true,
        say: "Notfall ist aufgenommen. Sagen Sie nur noch kurz: „Ich verbinde Sie jetzt mit dem Notdienst.“ Die Verbindung stellt das System selbst her – transfer_call nicht aufrufen.",
      };
    }
    const transferNumber = target;
    return {
      ok: true, reference: res.ticket.id.slice(-8).toUpperCase(), employee: emp?.name ?? null, transferNumber,
      say: transferNumber
        ? `Notfall ist aufgenommen. Jetzt mit transfer_call an ${transferNumber} durchstellen.`
        : `Notfall ist aufgenommen. ${emp?.name ?? "Der Notdienst"} ruft schnellstmöglich zurück.`,
    };
  },

  async recording_consent(args, ctx) {
    if (!ctx.callRowId) return { ok: false, say: "Antwort notiert." };
    await prisma.call.update({ where: { id: ctx.callRowId }, data: { recordingConsent: args.granted ? "GRANTED" : "DENIED", recordingConsentAt: new Date() } });
    return { ok: true, say: args.granted ? "Danke. Wie kann ich Ihnen helfen?" : "Gern, dann wird das Gespräch nicht gespeichert. Wie kann ich Ihnen helfen?" };
  },

  async find_appointments(_args, ctx) {
    const list = await callerAppointments(ctx);
    if (!list) return NO_VERIFIED_NUMBER;
    if (!list.length) return { found: false, appointments: [], say: "Zu dieser Rufnummer gibt es keinen kommenden Termin." };
    const tz = ctx.tenant.timezone;
    const appointments = list.map((t) => ({ reference: ref(t.id), label: formatGermanDateTime(t.appointmentStart!, tz), category: t.category, employee: t.assignedEmployee?.name ?? null }));
    return { found: true, appointments, say: `Kommende Termine: ${appointments.map((a) => `${a.label}${a.category ? ` (${a.category})` : ""}`).join("; ")}.` };
  },

  async reschedule_appointment(args, ctx) {
    const pick = await pickAppointment(ctx, args.reference);
    if ("error" in pick) return pick.error;
    const t = pick.ticket;
    if (!t.assignedEmployee) return { ok: false, say: "Für diesen Termin ist niemand eingeplant. Bitte Rückruf durch das Büro anbieten." };
    const tz = ctx.tenant.timezone;
    const svc = t.serviceId ? await prisma.service.findFirst({ where: { id: t.serviceId, tenantId: ctx.tenant.id } }) : null;
    const target = (await travelEnabled(ctx.tenant.id, ctx.cfg)) ? await locate(t.customer) : null;
    const alternatives = async () => (await findAvailableSlots(ctx.tenant, cfgForService(ctx.cfg, svc), t.assignedEmployee!, { target })).slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, tz) }));
    if (!args.appointmentStart) {
      const slots = await alternatives();
      return { ok: false, reference: ref(t.id), current: formatGermanDateTime(t.appointmentStart!, tz), slots, say: slots.length ? `Freie Termine: ${slots.map((s) => s.label).join("; ")}. Danach reschedule_appointment mit appointmentStart aufrufen.` : "Keine freien Termine gefunden – Rückruf zur Terminabstimmung anbieten." };
    }
    const r = await rescheduleAppointment(ctx.tenant, ctx.cfg, t, new Date(args.appointmentStart), { defer: true });
    if (!r.ok) {
      const slots = await alternatives();
      return { ok: false, slotTaken: r.reason === "slot_taken", slots, say: `Dieser Termin geht leider nicht. ${slots.length ? `Alternativen: ${slots.map((s) => s.label).join("; ")}.` : "Bitte Rückruf anbieten."}` };
    }
    return { ok: true, reference: ref(t.id), appointment: r.appointment.start.toISOString(), say: `Der Termin ist verschoben auf ${formatGermanDateTime(r.appointment.start, tz)}${t.assignedEmployee ? ` mit ${t.assignedEmployee.name}` : ""}.` };
  },

  async cancel_appointment(args, ctx) {
    const pick = await pickAppointment(ctx, args.reference);
    if ("error" in pick) return pick.error;
    const when = formatGermanDateTime(pick.ticket.appointmentStart!, ctx.tenant.timezone);
    await cancelAppointment(ctx.tenant, ctx.cfg, pick.ticket, { reason: args.reason, defer: true });
    return { ok: true, reference: ref(pick.ticket.id), say: `Der Termin am ${when} ist abgesagt. Das Team ist informiert.` };
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
