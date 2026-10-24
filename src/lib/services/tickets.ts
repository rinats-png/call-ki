import type { CallTicket, Customer, Employee, Tenant } from "@prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";
import { assessUrgency } from "../urgency";
import { routeTechnician, type RoutingResult } from "../routing";
import { createCalendarEvent, createMailDraft } from "../graph";
import { getMicrosoftLink, isSlotFree, removeCalendarEvent } from "../calendar";
import { googleCreateEvent, googleLinked } from "../google";
import { hasFeature, planForTenant } from "../billing";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { formatGermanDateTime } from "../time";
import { xmlEscape as h } from "../twiml";
import { buildIcs } from "../notify/ics";
import { URGENCIES, type Urgency } from "../constants";
import type { TenantConfig } from "../tenant/settings";
import { customerConfirmationEmail, customerSms, technicianBriefingEmail, technicianSms, type MailCtx } from "./emails";
import { markCustomerExisting, upsertCustomer, type CustomerInput } from "./customers";
import { runAfterResponse } from "../defer";
import { env } from "../env";
import { emitWebhook, ticketPayload } from "./webhooks";

type T = Pick<Tenant, "id" | "name" | "timezone">;

export async function loadRoutingCandidates(tenantId: string) {
  const employees = await prisma.employee.findMany({
    where: { tenantId, active: true },
    include: { _count: { select: { tickets: { where: { status: { in: ["PENDING", "ESCALATED"] } } } } } },
  });
  return employees.map(({ _count, ...e }) => ({ ...e, openTickets: _count.tickets }));
}

export async function routeRequest(tenantId: string, cfg: TenantConfig, input: { postalCode?: string | null; urgency: Urgency; customerType?: string | null; category?: string | null }): Promise<RoutingResult> {
  return routeTechnician(
    { ...input, specialistCustomerTypes: cfg.template.specialistCustomerTypes, roleLabels: cfg.template.roleLabels },
    await loadRoutingCandidates(tenantId),
  );
}

function cleanUrgency(u?: string | null): Urgency | null {
  const v = u?.toUpperCase();
  return v && (URGENCIES as readonly string[]).includes(v) ? (v as Urgency) : null;
}

function normalizeCategory(cfg: TenantConfig, c?: string | null): string {
  const v = (c ?? "").trim();
  if (!v) return "Sonstiges";
  return cfg.categories.find((k) => k.toLowerCase() === v.toLowerCase()) ?? v.charAt(0).toUpperCase() + v.slice(1);
}

export type ServiceRequestInput = {
  customer: CustomerInput;
  category?: string | null;
  description?: string | null;
  urgency?: string | null;
  appointmentStart?: string | Date | null;
  employeeId?: string | null;
  callId?: string | null;
  escalate?: boolean;
  /** Kalender & Benachrichtigungen erst nach der Antwort ausführen (Sprach-KI wartet nicht darauf) */
  deferNotify?: boolean;
};

export type ServiceRequestResult = {
  ticket: CallTicket & { customer: Customer; assignedEmployee: Employee | null };
  routing: RoutingResult;
  appointment: { start: Date; end: Date } | null;
  slotTaken: boolean;
  notify: NotifyResult;
};

/**
 * Zentraler Ablauf (identisch für Sprach-KI und manuelle Erfassung):
 * Kunde anlegen/ergänzen → Dringlichkeit → Routing → Slot erneut prüfen →
 * Ticket anlegen bzw. (gleicher Anruf) aktualisieren → Kalender & Benachrichtigungen.
 */
export async function processServiceRequest(tenant: T, cfg: TenantConfig, input: ServiceRequestInput): Promise<ServiceRequestResult> {
  const customer = await upsertCustomer(tenant.id, input.customer);
  const category = normalizeCategory(cfg, input.category);
  const urgency: Urgency = input.escalate
    ? "CRITICAL"
    : assessUrgency({ category, description: input.description, customerType: customer.customerType, aiUrgency: cleanUrgency(input.urgency), rules: cfg.urgencyRules });

  const routing = await routeRequest(tenant.id, cfg, { postalCode: customer.postalCode, urgency, customerType: customer.customerType, category });
  let employee: Employee | null = null;
  if (input.employeeId) employee = await prisma.employee.findFirst({ where: { id: input.employeeId, tenantId: tenant.id, active: true } });
  if (!employee && routing.employee) employee = await prisma.employee.findFirst({ where: { id: routing.employee.id, tenantId: tenant.id } });

  // Idempotenz: dieselbe KI-Unterhaltung erzeugt höchstens ein Ticket
  const existing = input.callId ? await prisma.callTicket.findFirst({ where: { tenantId: tenant.id, callId: input.callId }, orderBy: { createdAt: "desc" } }) : null;

  let appointment: { start: Date; end: Date } | null = null;
  let slotTaken = false;
  if (input.appointmentStart && employee) {
    const start = new Date(input.appointmentStart);
    if (!Number.isNaN(start.getTime()) && start.getTime() > Date.now() - 5 * 60000) {
      const slot = { start, end: new Date(start.getTime() + cfg.durationMin * 60000) };
      if (await isSlotFree(tenant.id, cfg, employee, slot, existing?.id)) appointment = slot;
      else slotTaken = true;
    }
  }

  const summary = (input.description?.trim() || `Anfrage: ${category}`).slice(0, 4000);
  const status = urgency === "CRITICAL" ? "ESCALATED" : appointment ? "PROCESSED" : "PENDING";
  const data = {
    customerId: customer.id,
    assignedEmployeeId: employee?.id ?? null,
    category,
    urgency,
    summary,
    status,
    callId: input.callId ?? null,
    ...(appointment ? { appointmentStart: appointment.start, appointmentEnd: appointment.end, reminderSentAt: null } : {}),
  };

  const ticket = existing
    ? await prisma.callTicket.update({ where: { id: existing.id }, data, include: { customer: true, assignedEmployee: true } })
    : await prisma.callTicket.create({ data: { tenantId: tenant.id, ...data }, include: { customer: true, assignedEmployee: true } });

  if (input.callId) await prisma.call.updateMany({ where: { id: input.callId, tenantId: tenant.id }, data: { customerId: customer.id } });

  let notify = emptyNotify();
  if (!slotTaken && input.deferNotify) {
    runAfterResponse("ticket.notify", () => notifyForTicket(tenant, cfg, ticket, employee, appointment, { isUpdate: !!existing }));
    const plan = (await planForTenant(tenant.id)).plan;
    const planned = confirmationPlanned(cfg, ticket.customer, urgency === "CRITICAL", hasFeature(plan, "sms"), hasFeature(plan, "email_notifications"));
    notify = { ...notify, deferred: true, confirmationPlanned: planned };
  } else if (!slotTaken) {
    notify = await notifyForTicket(tenant, cfg, ticket, employee, appointment, { isUpdate: !!existing });
  }
  await markCustomerExisting(tenant.id, customer.id);

  const fresh = await prisma.callTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: { customer: true, assignedEmployee: true } });
  await emitWebhook(tenant.id, existing ? "ticket.updated" : "ticket.created", ticketPayload(fresh));
  logger.info("ticket.saved", { tenantId: tenant.id, ticketId: ticket.id, urgency, updated: !!existing, slotTaken });
  return { ticket: fresh, routing, appointment, slotTaken, notify };
}

export type NotifyResult = {
  calendarEvent: boolean; customer: string[]; technician: string[]; errors: string[];
  /** Versand läuft erst nach der Antwort; dann nur die Vorhersage confirmationPlanned */
  deferred?: boolean;
  confirmationPlanned?: boolean;
};

/** Bekommt der Kunde laut Einstellungen eine Bestätigung? (Vorhersage für die Ansage am Telefon) */
export function confirmationPlanned(cfg: TenantConfig, customer: Pick<Customer, "email">, critical: boolean, smsAllowed: boolean, emailAllowed = true): boolean {
  const mode = cfg.settings.notifications.customerConfirmation;
  if (mode === "off" || critical) return false;
  return ((mode === "email" || mode === "both") && !!customer.email && emailAllowed) || ((mode === "sms" || mode === "both") && smsAllowed);
}
const emptyNotify = (): NotifyResult => ({ calendarEvent: false, customer: [], technician: [], errors: [] });

/**
 * Kalender & Benachrichtigungen gemäß Mandanten-Einstellungen. Idempotent für
 * den Outlook-Termin (calendarEventId / transactionId). Bei Aktualisierung
 * desselben Tickets werden Benachrichtigungen nur bei neuem Termin erneut versendet.
 */
export async function notifyForTicket(
  tenant: T,
  cfg: TenantConfig,
  ticket: CallTicket & { customer: Customer },
  employee: Employee | null,
  appointment: { start: Date; end: Date } | null,
  opts: { isUpdate?: boolean; force?: boolean } = {},
): Promise<NotifyResult> {
  const res = emptyNotify();
  const n = cfg.settings.notifications;
  const ms = await getMicrosoftLink(tenant.id);
  const urgent = ticket.urgency === "HIGH" || ticket.urgency === "CRITICAL";
  const critical = ticket.urgency === "CRITICAL";
  const ctx: MailCtx = {
    tenant, cfg, customer: ticket.customer, employee,
    category: ticket.category ?? "Sonstiges", urgency: ticket.urgency, summary: ticket.summary ?? "", appointment, ticketId: ticket.id,
    includeSummary: n.summaryInNotifications, portalUrl: `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/?ticket=${ticket.id}`,
  };
  const calendarText = n.summaryInNotifications ? (ticket.summary ?? "") : "Details im Portal";
  const update: Partial<CallTicket> = {};
  const location = [ticket.customer.address, ticket.customer.postalCode].filter(Boolean).join(", ") || undefined;

  // 1) Outlook-Termin beim Mitarbeiter
  if (ms && employee?.email && appointment && !ticket.calendarEventId) {
    try {
      const ev = await createCalendarEvent(ms.msTenantId, {
        mailbox: employee.email, subject: `${urgent ? "⚠ " : ""}${ctx.category} – ${ticket.customer.companyName ?? ticket.customer.name ?? ticket.customer.phone}`,
        bodyHtml: technicianBriefingEmail(ctx).html, start: appointment.start, end: appointment.end, timeZone: tenant.timezone, location, urgent,
        transactionId: `ticket-${ticket.id}-${appointment.start.getTime()}`,
      });
      update.calendarEventId = ev.id;
      res.calendarEvent = true;
    } catch (err) {
      res.errors.push(`Outlook-Termin: ${(err as Error).message}`);
    }
  }

  // 1b) Google-Termin beim Mitarbeiter (wenn kein Outlook verbunden)
  if (!ms && employee?.email && appointment && !ticket.calendarEventId && !update.calendarEventId && (await googleLinked(tenant.id))) {
    try {
      const ev = await googleCreateEvent(tenant.id, employee.email, {
        subject: `${urgent ? "⚠ " : ""}${ctx.category} – ${ticket.customer.companyName ?? ticket.customer.name ?? ticket.customer.phone}`,
        bodyText: [calendarText, `Kunde: ${ticket.customer.name ?? ""} ${ticket.customer.phone}`, location].filter(Boolean).join("\n"),
        start: appointment.start, end: appointment.end, location, timeZone: tenant.timezone,
      });
      update.calendarEventId = `google:${ev.id}`;
      res.calendarEvent = true;
    } catch (err) {
      res.errors.push(`Google-Termin: ${(err as Error).message}`);
    }
  }

  // SMS nur, wenn im Paket enthalten (ohne Paket: erlaubt)
  const plan = (await planForTenant(tenant.id)).plan;
  const smsAllowed = hasFeature(plan, "sms");
  // E-Mails laut Paket; Notfall-Alarme gehen immer raus
  const emailAllowed = hasFeature(plan, "email_notifications");
  const shouldSend = opts.force || !opts.isUpdate || !!appointment;
  if (shouldSend) {
    // 2) Mitarbeiter informieren (bei Notfall gemäß emergencyAlert, sonst technicianAlert)
    const mode = critical ? n.emergencyAlert : n.technicianAlert;
    if (employee && mode !== "off") {
      if ((mode === "email" || mode === "both") && employee.email && (emailAllowed || critical)) {
        const mail = technicianBriefingEmail(ctx);
        const ics = appointment && !update.calendarEventId && !ticket.calendarEventId
          ? { filename: "termin.ics", content: buildIcs({ uid: `ticket-${ticket.id}@ki-telefonzentrale`, start: appointment.start, end: appointment.end, summary: mail.subject, description: calendarText, location }) }
          : undefined;
        const r = await sendEmail({ tenantId: tenant.id, ticketId: ticket.id, to: employee.email, subject: mail.subject, html: mail.html, purpose: critical ? "EMERGENCY_ALERT" : "TECHNICIAN_BRIEFING", fromName: tenant.name, ics });
        res.technician.push(`E-Mail ${r.status}`);
      }
      if ((mode === "sms" || mode === "both") && employee.directPhone && (smsAllowed || critical)) {
        const r = await sendSms({ tenantId: tenant.id, ticketId: ticket.id, to: employee.directPhone, body: technicianSms(ctx), purpose: critical ? "EMERGENCY_ALERT" : "TECHNICIAN_BRIEFING" });
        res.technician.push(`SMS ${r.status}`);
      }
    }

    // 3) Kundenbestätigung
    const cMode = n.customerConfirmation;
    if (cMode !== "off" && !critical) {
      if ((cMode === "email" || cMode === "both") && ticket.customer.email && emailAllowed) {
        const mail = customerConfirmationEmail(ctx);
        if (ms?.draftMailbox && n.microsoftDraftsOnly && !ticket.emailDraftId) {
          try {
            const d = await createMailDraft(ms.msTenantId, { mailbox: ms.draftMailbox, to: [ticket.customer.email], cc: employee?.email ? [employee.email] : [], subject: mail.subject, bodyHtml: mail.html, urgent });
            update.emailDraftId = d.id;
            await prisma.message.create({ data: { tenantId: tenant.id, ticketId: ticket.id, channel: "EMAIL", recipient: ticket.customer.email, subject: mail.subject, body: mail.html, purpose: "CUSTOMER_CONFIRMATION", status: "DRAFT", provider: "microsoft" } });
            res.customer.push("Outlook-Entwurf");
          } catch (err) {
            res.errors.push(`Outlook-Entwurf: ${(err as Error).message}`);
          }
        } else if (!ms?.draftMailbox || !n.microsoftDraftsOnly) {
          const ics = appointment ? { filename: "termin.ics", content: buildIcs({ uid: `ticket-${ticket.id}-kunde@ki-telefonzentrale`, start: appointment.start, end: appointment.end, summary: `${cfg.template.jobNoun}: ${tenant.name}`, description: ctx.category, location }) } : undefined;
          const r = await sendEmail({ tenantId: tenant.id, ticketId: ticket.id, to: ticket.customer.email, subject: mail.subject, html: mail.html, purpose: "CUSTOMER_CONFIRMATION", fromName: tenant.name, replyTo: n.backofficeEmail || undefined, ics });
          res.customer.push(`E-Mail ${r.status}`);
        }
      }
      if ((cMode === "sms" || cMode === "both") && smsAllowed && !ticket.customer.smsOptOutAt) {
        const r = await sendSms({ tenantId: tenant.id, ticketId: ticket.id, to: ticket.customer.phone, body: customerSms(ctx), purpose: "CUSTOMER_CONFIRMATION" });
        res.customer.push(`SMS ${r.status}`);
      }
    }

    // 4) Kopie ans Büro
    if (n.backofficeEmail && emailAllowed) {
      const mail = technicianBriefingEmail(ctx);
      await sendEmail({ tenantId: tenant.id, ticketId: ticket.id, to: n.backofficeEmail, subject: mail.subject, html: mail.html, purpose: "BACKOFFICE_COPY", fromName: tenant.name });
    }
  }

  if (Object.keys(update).length) await prisma.callTicket.update({ where: { id: ticket.id }, data: update });
  if (res.errors.length) logger.warn("ticket.notify_errors", { tenantId: tenant.id, ticketId: ticket.id, errors: res.errors });
  return res;
}

type TicketWithPeople = CallTicket & { customer: Customer; assignedEmployee: Employee | null };

/**
 * Termin verschieben (Telefon-KI oder Portal): Slot prüfen, alten Kalendertermin entfernen,
 * neuen Termin setzen, Erinnerung zurücksetzen, Beteiligte erneut benachrichtigen.
 */
export async function rescheduleAppointment(tenant: T, cfg: TenantConfig, ticket: TicketWithPeople, start: Date, opts: { defer?: boolean } = {}): Promise<{ ok: true; appointment: { start: Date; end: Date } } | { ok: false; reason: "no_employee" | "slot_taken" | "in_past" }> {
  const employee = ticket.assignedEmployee;
  if (!employee) return { ok: false, reason: "no_employee" };
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 5 * 60_000) return { ok: false, reason: "in_past" };
  const slot = { start, end: new Date(start.getTime() + cfg.durationMin * 60000) };
  if (!(await isSlotFree(tenant.id, cfg, employee, slot, ticket.id))) return { ok: false, reason: "slot_taken" };
  await removeCalendarEvent(tenant.id, employee.email, ticket.calendarEventId);
  const updated = await prisma.callTicket.update({
    where: { id: ticket.id },
    data: { appointmentStart: slot.start, appointmentEnd: slot.end, calendarEventId: null, reminderSentAt: null, status: ticket.status === "CLOSED" ? "PROCESSED" : ticket.status === "PENDING" ? "PROCESSED" : ticket.status, notes: appendNote(ticket.notes, `Termin verschoben auf ${formatGermanDateTime(slot.start, tenant.timezone)}.`) },
    include: { customer: true, assignedEmployee: true },
  });
  const run = () => notifyForTicket(tenant, cfg, updated, employee, slot, { force: true });
  if (opts.defer) runAfterResponse("ticket.reschedule_notify", run);
  else await run();
  logger.info("ticket.rescheduled", { tenantId: tenant.id, ticketId: ticket.id });
  return { ok: true, appointment: slot };
}

/** Termin absagen: Kalendertermin entfernen, Vorgang schließen, Mitarbeiter/Büro/Kunde informieren. */
export async function cancelAppointment(tenant: T, cfg: TenantConfig, ticket: TicketWithPeople, opts: { reason?: string; defer?: boolean } = {}) {
  const when = ticket.appointmentStart ? formatGermanDateTime(ticket.appointmentStart, tenant.timezone) : null;
  await removeCalendarEvent(tenant.id, ticket.assignedEmployee?.email ?? null, ticket.calendarEventId);
  await prisma.callTicket.update({
    where: { id: ticket.id },
    data: { appointmentStart: null, appointmentEnd: null, calendarEventId: null, status: "CLOSED", notes: appendNote(ticket.notes, `Termin${when ? ` am ${when}` : ""} vom Kunden abgesagt${opts.reason ? `: ${opts.reason}` : ""}.`) },
  });
  const run = async () => {
    const plan = (await planForTenant(tenant.id)).plan;
    if (!hasFeature(plan, "email_notifications")) return;
    const ref = ticket.id.slice(-8).toUpperCase();
    const who = ticket.customer.companyName ?? ticket.customer.name ?? ticket.customer.phone;
    const inner = `<p>Der Termin${when ? ` am <b>${h(when)}</b>` : ""} (${h(ticket.category ?? "Vorgang")}, ${h(who)}) wurde vom Kunden abgesagt${opts.reason ? `: ${h(opts.reason)}` : ""}.</p><p>Vorgangsnummer ${h(ref)}</p>`;
    const internal = [ticket.assignedEmployee?.email, cfg.settings.notifications.backofficeEmail].filter((x): x is string => !!x);
    for (const to of new Set(internal)) await sendEmail({ tenantId: tenant.id, ticketId: ticket.id, to, subject: `Abgesagt: ${ticket.category ?? "Termin"}${when ? ` am ${when}` : ""}`, html: emailLayout(inner, tenant.name), purpose: "TECHNICIAN_BRIEFING", fromName: tenant.name });
    if (ticket.customer.email) {
      await sendEmail({ tenantId: tenant.id, ticketId: ticket.id, to: ticket.customer.email, subject: `Ihr Termin${when ? ` am ${when}` : ""} ist abgesagt`, html: emailLayout(`<p>Guten Tag,</p><p>wie besprochen haben wir Ihren Termin${when ? ` am <b>${h(when)}</b>` : ""} abgesagt. Melden Sie sich gern, wenn Sie einen neuen Termin möchten.</p><p>Mit freundlichen Grüßen<br/>${h(tenant.name)}</p>`, `${h(tenant.name)} · Vorgangsnummer ${h(ref)}`), purpose: "CUSTOMER_CONFIRMATION", fromName: tenant.name, replyTo: cfg.settings.notifications.backofficeEmail || undefined });
    }
  };
  if (opts.defer) runAfterResponse("ticket.cancel_notify", run);
  else await run();
  logger.info("ticket.appointment_cancelled", { tenantId: tenant.id, ticketId: ticket.id });
}

function appendNote(notes: string | null, line: string) {
  return [notes, line].filter(Boolean).join("\n").slice(-4000);
}
