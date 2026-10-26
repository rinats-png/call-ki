import { prisma } from "../db";
import { hasFeature, planForTenant } from "../billing";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { resolveConfig } from "../tenant/settings";
import { xmlEscape as h } from "../twiml";
import { logger } from "../logger";
import { hasModule } from "../addons";

const wantsEmail = (m: string) => m === "email" || m === "both";
const wantsSms = (m: string) => m === "sms" || m === "both";

/** „Ihr Techniker ist unterwegs“ an den Kunden (Einstellung contact.enRoute), höchstens einmal je Einsatz. */
export async function onJobEnRoute(tenantId: string, ticketId: string, employeeName: string) {
  const t = await prisma.callTicket.findFirst({ where: { id: ticketId, tenantId }, include: { customer: true, tenant: true } });
  if (!t) return { sent: false };
  const cfg = resolveConfig(t.tenant);
  const mode = cfg.settings.contact.enRoute;
  if (mode === "off" || !(await hasModule(tenantId, "customer_contact"))) return { sent: false };
  const plan = (await planForTenant(tenantId)).plan;
  const first = employeeName.split(/\s+/)[0];
  const phone = cfg.settings.notifications.contactPhone;
  let sent = false;
  if (wantsSms(mode) && hasFeature(plan, "sms") && !t.customer.smsOptOutAt) {
    await sendSms({ tenantId, ticketId, to: t.customer.phone, body: `${t.tenant.name}: ${first} ist jetzt unterwegs zu Ihnen.${phone ? ` Rückfragen: ${phone}.` : ""}`, purpose: "JOB_UPDATE" });
    sent = true;
  }
  if (wantsEmail(mode) && t.customer.email && hasFeature(plan, "email_notifications")) {
    const html = emailLayout(`<p>${t.customer.name ? `Guten Tag ${h(t.customer.name)},` : "Guten Tag,"}</p><p><b>${h(first)}</b> ist jetzt unterwegs zu Ihnen.</p>${phone ? `<p>Rückfragen: <b>${h(phone)}</b></p>` : ""}<p>Mit freundlichen Grüßen<br/>${h(t.tenant.name)}</p>`, h(t.tenant.name));
    await sendEmail({ tenantId, ticketId, to: t.customer.email, subject: `${first} ist unterwegs zu Ihnen`, html, purpose: "JOB_UPDATE", fromName: t.tenant.name });
    sent = true;
  }
  return { sent };
}

/**
 * Bitte um Bewertung nach Abschluss eines Termins (Einstellung contact.reviewRequest, Verzögerung reviewDelayHours).
 * Auslöser: Vorgang mit Termin wurde erledigt (Büro oder Techniker-App, `closedAt`); Absagen zählen nicht.
 * Je Kunde höchstens alle 90 Tage; ältere Abschlüsse (> 7 Tage) werden nur noch als erledigt markiert.
 */
export async function runReviewRequests(now = new Date()) {
  const due = await prisma.callTicket.findMany({
    where: { status: "CLOSED", closedAt: { not: null, lte: now }, appointmentStart: { not: null }, reviewHandledAt: null, tenant: { status: { not: "PAUSED" } } },
    include: { tenant: true, customer: true, assignedEmployee: { select: { name: true } } },
    orderBy: { closedAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const t of due) {
    const cfg = resolveConfig(t.tenant);
    const c = cfg.settings.contact;
    const ageH = (now.getTime() - t.closedAt!.getTime()) / 3600_000;
    const enabled = c.reviewRequest !== "off" && !!c.reviewUrl && (await hasModule(t.tenantId, "customer_contact", now));
    if (enabled && ageH < c.reviewDelayHours) continue;
    const customer = t.customer;
    const recent = customer.reviewRequestedAt && now.getTime() - customer.reviewRequestedAt.getTime() < 90 * 86400_000;
    let any = false;
    if (enabled && ageH <= 7 * 24 && !recent) {
      const plan = (await planForTenant(t.tenantId)).plan;
      if (wantsSms(c.reviewRequest) && hasFeature(plan, "sms") && !customer.smsOptOutAt) {
        await sendSms({ tenantId: t.tenantId, ticketId: t.id, to: customer.phone, body: `${t.tenant.name}: Danke für Ihren Auftrag! Waren Sie zufrieden? Über eine kurze Bewertung freuen wir uns: ${c.reviewUrl}`, purpose: "REVIEW_REQUEST" });
        any = true;
      }
      if (wantsEmail(c.reviewRequest) && customer.email && hasFeature(plan, "email_notifications")) {
        const html = emailLayout(`<p>${customer.name ? `Guten Tag ${h(customer.name)},` : "Guten Tag,"}</p><p>vielen Dank für Ihren Auftrag${t.assignedEmployee ? ` – ${h(t.assignedEmployee.name.split(/\s+/)[0])} war gerne bei Ihnen` : ""}.</p><p>Waren Sie zufrieden? Über eine kurze Bewertung freuen wir uns sehr:</p><p><a href="${h(c.reviewUrl)}">Jetzt bewerten</a></p><p>Mit freundlichen Grüßen<br/>${h(t.tenant.name)}</p>`, h(t.tenant.name));
        await sendEmail({ tenantId: t.tenantId, ticketId: t.id, to: customer.email, subject: `Wie zufrieden waren Sie mit ${t.tenant.name}?`, html, purpose: "REVIEW_REQUEST", fromName: t.tenant.name });
        any = true;
      }
      if (any) await prisma.customer.update({ where: { id: customer.id }, data: { reviewRequestedAt: now } });
    }
    await prisma.callTicket.update({ where: { id: t.id }, data: { reviewHandledAt: now } });
    if (any) sent++;
  }
  if (sent) logger.info("reviews.sent", { sent });
  return { checked: due.length, sent };
}
