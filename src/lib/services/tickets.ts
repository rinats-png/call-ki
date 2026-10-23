import type { CallTicket, Customer, Employee } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { assessUrgency } from "../urgency";
import { routeTechnician, type RoutingResult } from "../routing";
import { createCalendarEvent, createMailDraft } from "../graph";
import { customerConfirmationEmail, eventBody, technicianBriefingEmail } from "./emails";
import { markCustomerExisting, upsertCustomer, type CustomerInput } from "./customers";
import { URGENCIES, type Urgency } from "../constants";

export async function loadRoutingCandidates() {
  const employees = await prisma.employee.findMany({
    include: { _count: { select: { tickets: { where: { status: "PENDING" } } } } },
  });
  return employees.map(({ _count, ...e }) => ({ ...e, openTickets: _count.tickets }));
}

export async function routeRequest(input: { postalCode?: string | null; urgency: Urgency; customerType?: string | null; pestType?: string | null }): Promise<RoutingResult> {
  return routeTechnician(input, await loadRoutingCandidates());
}

function normalizePest(p?: string | null): string {
  const v = (p ?? "").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "Unbekannt";
}

function cleanUrgency(u?: string | null): Urgency | null {
  const v = u?.toUpperCase();
  return v && (URGENCIES as readonly string[]).includes(v) ? (v as Urgency) : null;
}

export type ServiceRequestInput = {
  customer: CustomerInput;
  pestType?: string | null;
  description?: string | null;
  urgency?: string | null;
  appointmentStart?: string | Date | null;
  employeeId?: string | null;
  transcript?: string | null;
  escalate?: boolean;
};

export type ServiceRequestResult = {
  ticket: CallTicket & { customer: Customer; assignedEmployee: Employee | null };
  routing: RoutingResult;
  appointment: { start: Date; end: Date } | null;
  outlook: { eventCreated: boolean; draftCreated: boolean; dryRun: boolean; errors: string[] };
};

/**
 * Zentraler Workflow nach einem Gespräch:
 *  Kunde anlegen/aktualisieren → Dringlichkeit prüfen → Techniker routen →
 *  Ticket erstellen → Outlook-Termin + E-Mail-Entwurf via Graph → Status setzen.
 */
export async function processServiceRequest(input: ServiceRequestInput): Promise<ServiceRequestResult> {
  const customer = await upsertCustomer(input.customer);
  const pestType = normalizePest(input.pestType);
  const urgency = input.escalate
    ? "CRITICAL"
    : assessUrgency({ pestType, description: input.description, customerType: customer.customerType, aiUrgency: cleanUrgency(input.urgency) });

  const routing = await routeRequest({ postalCode: customer.postalCode, urgency, customerType: customer.customerType, pestType });
  let employee: Employee | null = null;
  if (input.employeeId) employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee && routing.employee) employee = await prisma.employee.findUnique({ where: { id: routing.employee.id } });

  const summary = (input.description?.trim() || `Anfrage zu ${pestType}`).slice(0, 2000);

  const ticket = await prisma.callTicket.create({
    data: {
      customerId: customer.id,
      assignedEmployeeId: employee?.id,
      pestType,
      urgency,
      summary,
      transcript: input.transcript ?? undefined,
      status: urgency === "CRITICAL" ? "ESCALATED" : "PENDING",
    },
    include: { customer: true, assignedEmployee: true },
  });

  let appointment: { start: Date; end: Date } | null = null;
  if (input.appointmentStart) {
    const start = new Date(input.appointmentStart);
    if (!Number.isNaN(start.getTime()) && start.getTime() > Date.now() - 5 * 60000) {
      appointment = { start, end: new Date(start.getTime() + env().APPOINTMENT_DURATION_MIN * 60000) };
    }
  }

  const outlook = await syncOutlook(ticket, employee, appointment);
  // Kunde mit abgeschlossener Anfrage zählt künftig als Bestandskunde
  await markCustomerExisting(customer.id);

  const fresh = await prisma.callTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: { customer: true, assignedEmployee: true } });
  logger.info("ticket.created", { ticketId: ticket.id, urgency, pestType, employee: employee?.name, outlook });
  return { ticket: fresh, routing, appointment, outlook };
}

/**
 * Legt Termin (Kalender des Technikers) und E-Mail-Entwurf an. Idempotent:
 * bereits vorhandene IDs werden nicht erneut erzeugt – daher auch für
 * "Erneut synchronisieren" im Dashboard nutzbar.
 */
export async function syncOutlook(
  ticket: CallTicket & { customer: Customer },
  employee: Employee | null,
  appointment: { start: Date; end: Date } | null,
) {
  const e = env();
  const errors: string[] = [];
  let eventCreated = false;
  let draftCreated = false;
  let dryRun = false;
  const update: Partial<Pick<CallTicket, "outlookEventId" | "outlookDraftId" | "status">> = {};

  const ctx = {
    customer: ticket.customer,
    employee,
    pestType: ticket.pestType ?? "Unbekannt",
    urgency: ticket.urgency,
    summary: ticket.summary ?? "",
    appointment,
    timeZone: e.BUSINESS_TIMEZONE,
    ticketId: ticket.id,
  };
  const urgent = ticket.urgency === "HIGH" || ticket.urgency === "CRITICAL";

  if (employee && appointment && !ticket.outlookEventId) {
    try {
      const ev = await createCalendarEvent({
        upn: employee.microsoftUpn,
        subject: `${urgent ? "⚠ " : ""}${ctx.pestType} – ${ticket.customer.companyName ?? ticket.customer.name ?? ticket.customer.phone}`,
        bodyHtml: eventBody(ctx),
        start: appointment.start,
        end: appointment.end,
        location: [ticket.customer.address, ticket.customer.postalCode].filter(Boolean).join(", ") || undefined,
        urgent,
        transactionId: `ticket-${ticket.id}`,
      });
      update.outlookEventId = ev.id;
      eventCreated = true;
      dryRun ||= !!ev.dryRun;
    } catch (err) {
      errors.push(`Termin: ${(err as Error).message}`);
      logger.error("graph.event_failed", { ticketId: ticket.id, error: (err as Error).message });
    }
  }

  if (!ticket.outlookDraftId) {
    const mailbox = e.MS_DRAFT_MAILBOX ?? employee?.microsoftUpn;
    if (mailbox) {
      const mail = ticket.customer.email ? customerConfirmationEmail(ctx) : technicianBriefingEmail(ctx);
      const to = ticket.customer.email ? [ticket.customer.email] : employee ? [employee.microsoftUpn] : [mailbox];
      const cc = ticket.customer.email && employee ? [employee.microsoftUpn] : [];
      try {
        const d = await createMailDraft({ mailbox, to, cc, subject: mail.subject, bodyHtml: mail.html, urgent });
        update.outlookDraftId = d.id;
        draftCreated = true;
        dryRun ||= !!d.dryRun;
      } catch (err) {
        errors.push(`Entwurf: ${(err as Error).message}`);
        logger.error("graph.draft_failed", { ticketId: ticket.id, error: (err as Error).message });
      }
    }
  }

  const hasEvent = !!(update.outlookEventId ?? ticket.outlookEventId);
  const hasDraft = !!(update.outlookDraftId ?? ticket.outlookDraftId);
  if (ticket.status !== "ESCALATED" && errors.length === 0 && (hasEvent || hasDraft)) update.status = "PROCESSED";

  if (Object.keys(update).length) await prisma.callTicket.update({ where: { id: ticket.id }, data: update });
  return { eventCreated, draftCreated, dryRun, errors };
}

/**
 * Ordnet Transkript & Zusammenfassung nach Gesprächsende dem Ticket zu.
 * Das Schema enthält keine Call-ID, daher Zuordnung über die Rufnummer:
 * jüngstes Ticket des Anrufers der letzten 3 Stunden ohne Transkript.
 * Existiert keines (Anrufer hat vorzeitig aufgelegt), wird ein Rückruf-Ticket
 * angelegt – so geht kein Lead verloren.
 */
export async function attachCallRecord(input: {
  phone: string;
  transcript?: string | null;
  summary?: string | null;
  durationSec?: number | null;
  /** Immer neues Rückruf-Ticket anlegen (z. B. Mailbox-Nachricht). */
  forceCallback?: boolean;
}) {
  const customer = await upsertCustomer({ phone: input.phone });
  const since = new Date(Date.now() - 3 * 3600_000);
  const ticket = input.forceCallback ? null : await prisma.callTicket.findFirst({
    where: { customerId: customer.id, createdAt: { gte: since }, transcript: null },
    orderBy: { createdAt: "desc" },
  });

  if (ticket) {
    return prisma.callTicket.update({
      where: { id: ticket.id },
      data: {
        transcript: input.transcript ?? undefined,
        summary: ticket.summary && ticket.summary.length > 20 ? ticket.summary : input.summary ?? ticket.summary,
      },
    });
  }

  if (!input.forceCallback && (input.durationSec ?? 99) < 8 && !input.transcript) return null; // Fehlwahl / sofort aufgelegt

  const urgency = assessUrgency({ description: `${input.summary ?? ""} ${input.transcript ?? ""}`, customerType: customer.customerType });
  const routing = await routeRequest({ postalCode: customer.postalCode, urgency, customerType: customer.customerType });
  return prisma.callTicket.create({
    data: {
      customerId: customer.id,
      assignedEmployeeId: routing.employee?.id,
      pestType: "Unbekannt",
      urgency,
      summary: `Gespräch ohne Abschluss – Rückruf erforderlich. ${input.summary ?? ""}`.trim(),
      transcript: input.transcript ?? undefined,
      status: urgency === "CRITICAL" ? "ESCALATED" : "PENDING",
    },
  });
}
