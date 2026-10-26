import { prisma } from "../db";
import { activeModules } from "../addons";

export type TimelineItem = {
  id: string;
  at: string;
  kind: "call" | "ticket" | "appointment" | "message" | "report" | "bill" | "payment" | "task";
  title: string;
  detail?: string | null;
  tone?: "default" | "warn" | "good" | "muted";
  ticketId?: string | null;
  href?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

const PURPOSE: Record<string, string> = {
  CUSTOMER_CONFIRMATION: "Terminbestätigung", APPOINTMENT_REMINDER: "Terminerinnerung", JOB_UPDATE: "Info zum Einsatz", REVIEW_REQUEST: "Bitte um Bewertung",
  BILL: "Beleg versendet", PAYMENT_REMINDER: "Zahlungserinnerung/Mahnung", TECHNICIAN_BRIEFING: "Info an Mitarbeiter", EMERGENCY_ALERT: "Notfall-Alarm", BACKOFFICE_COPY: "Kopie ans Büro",
};
const KIND: Record<string, string> = { QUOTE: "Angebot", INVOICE: "Rechnung", CREDIT_NOTE: "Gutschrift" };
const eur = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const sec = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} Min.` : null);

/** Kundenakte: alles zu einem Kunden in einem Verlauf (neueste zuerst) plus Kennzahlen. */
export async function customerFile(tenantId: string, customerId: string) {
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!c) return null;
  const modules = await activeModules(tenantId);
  const [calls, tickets, messages, bills, tasks] = await Promise.all([
    prisma.call.findMany({ where: { tenantId, customerId }, orderBy: { startedAt: "desc" }, take: 200, select: { id: true, startedAt: true, durationSec: true, status: true, summary: true, recordingUrl: true, endReason: true } }),
    prisma.callTicket.findMany({
      where: { tenantId, customerId }, orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, createdAt: true, category: true, urgency: true, status: true, summary: true, appointmentStart: true, appointmentEnd: true, confirmation: true, closedAt: true, notes: true, assignedEmployee: { select: { name: true } }, service: { select: { name: true } },
        jobReport: { select: { id: true, status: true, finishedAt: true, findings: true, workDone: true, signatureName: true, _count: { select: { photos: true } } } } },
    }),
    prisma.message.findMany({
      where: { tenantId, OR: [{ ticket: { customerId } }, { recipient: c.phone }, ...(c.email ? [{ recipient: c.email }] : [])], purpose: { notIn: ["TECHNICIAN_BRIEFING", "BACKOFFICE_COPY", "EMERGENCY_ALERT"] } },
      orderBy: { createdAt: "desc" }, take: 200, select: { id: true, createdAt: true, channel: true, purpose: true, status: true, subject: true, ticketId: true },
    }),
    prisma.bill.findMany({ where: { tenantId, customerId, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 200, select: { id: true, kind: true, number: true, status: true, issueDate: true, grossCents: true, paidAt: true, dueAt: true, ticketId: true } }),
    prisma.task.findMany({ where: { tenantId, ticket: { customerId } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, createdAt: true, doneAt: true, ticketId: true } }),
  ]);
  const items: TimelineItem[] = [];
  for (const k of calls) items.push({ id: `call-${k.id}`, at: k.startedAt.toISOString(), kind: "call", title: k.status === "FALLBACK" ? "Anruf an Ersatznummer" : k.status === "VOICEMAIL" ? "Nachricht auf der Mailbox" : "Anruf mit Eira", detail: [sec(k.durationSec), k.summary].filter(Boolean).join(" · ") || null, meta: { recording: !!k.recordingUrl, callId: k.id } });
  for (const t of tickets) {
    items.push({ id: `ticket-${t.id}`, at: t.createdAt.toISOString(), kind: "ticket", title: `Vorgang: ${t.service?.name ?? t.category ?? "Anliegen"}`, detail: t.summary, ticketId: t.id, tone: t.urgency === "CRITICAL" || t.urgency === "HIGH" ? "warn" : "default", meta: { status: t.status, urgency: t.urgency } });
    if (t.appointmentStart) items.push({ id: `appt-${t.id}`, at: t.appointmentStart.toISOString(), kind: "appointment", title: `Termin${t.assignedEmployee ? ` mit ${t.assignedEmployee.name}` : ""}`, detail: t.confirmation === "CONFIRMED" ? "vom Kunden bestätigt" : t.confirmation === "DECLINED" ? "Kunde: passt nicht" : null, ticketId: t.id, tone: t.appointmentStart > new Date() ? "good" : "default", meta: { upcoming: t.appointmentStart > new Date() } });
    const r = t.jobReport;
    if (r?.status === "DONE" && r.finishedAt) items.push({ id: `report-${r.id}`, at: r.finishedAt.toISOString(), kind: "report", title: "Einsatz abgeschlossen", detail: [r.workDone || r.findings, r._count.photos ? `${r._count.photos} Foto${r._count.photos === 1 ? "" : "s"}` : null, r.signatureName ? `unterschrieben von ${r.signatureName}` : null].filter(Boolean).join(" · "), ticketId: t.id, tone: "good" });
  }
  for (const m of messages) items.push({ id: `msg-${m.id}`, at: m.createdAt.toISOString(), kind: "message", title: `${m.channel === "SMS" ? "SMS" : "E-Mail"}: ${PURPOSE[m.purpose] ?? m.purpose}`, detail: m.subject, ticketId: m.ticketId, tone: m.status === "FAILED" ? "warn" : "muted", meta: { status: m.status } });
  for (const b of bills) {
    items.push({ id: `bill-${b.id}`, at: (b.issueDate ?? new Date(0)).toISOString(), kind: "bill", title: `${KIND[b.kind] ?? b.kind} ${b.number ?? ""}`.trim(), detail: `${eur(b.grossCents)}${b.status === "CANCELLED" ? " · storniert" : b.status === "ISSUED" && b.kind === "INVOICE" ? ` · offen${b.dueAt && b.dueAt < new Date() ? ", überfällig" : ""}` : ""}`, ticketId: b.ticketId, href: "/billing", tone: b.status === "ISSUED" && b.kind === "INVOICE" && b.dueAt && b.dueAt < new Date() ? "warn" : "default" });
    if (b.paidAt) items.push({ id: `paid-${b.id}`, at: b.paidAt.toISOString(), kind: "payment", title: `Zahlung eingegangen: ${b.number}`, detail: eur(b.grossCents), tone: "good", href: "/billing" });
  }
  for (const t of tasks) items.push({ id: `task-${t.id}`, at: t.createdAt.toISOString(), kind: "task", title: `Aufgabe: ${t.title}`, detail: t.doneAt ? "erledigt" : "offen", ticketId: t.ticketId, tone: t.doneAt ? "muted" : "default" });
  items.sort((a, b) => b.at.localeCompare(a.at));

  const now = new Date();
  const next = tickets.filter((t) => t.appointmentStart && t.appointmentStart > now && t.status !== "CLOSED").sort((a, b) => a.appointmentStart!.getTime() - b.appointmentStart!.getTime())[0];
  const invoices = bills.filter((b) => b.kind === "INVOICE");
  const showMoney = modules.includes("invoicing") || bills.length > 0;
  return {
    customer: c,
    stats: {
      calls: calls.length,
      tickets: tickets.length,
      openTickets: tickets.filter((t) => t.status === "PENDING" || t.status === "ESCALATED").length,
      jobsDone: tickets.filter((t) => t.jobReport?.status === "DONE" || t.closedAt).length,
      nextAppointment: next ? { at: next.appointmentStart!.toISOString(), ticketId: next.id, employee: next.assignedEmployee?.name ?? null } : null,
      firstContact: [...calls.map((x) => x.startedAt), ...tickets.map((x) => x.createdAt)].sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString() ?? c.createdAt.toISOString(),
      ...(showMoney ? { revenueCents: invoices.filter((b) => b.status === "PAID").reduce((s, b) => s + b.grossCents, 0), openCents: invoices.filter((b) => b.status === "ISSUED").reduce((s, b) => s + b.grossCents, 0) } : {}),
    },
    items,
  };
}
