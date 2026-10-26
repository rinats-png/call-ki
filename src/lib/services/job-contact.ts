import { prisma } from "../db";
import { hasFeature, planForTenant } from "../billing";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { resolveConfig } from "../tenant/settings";
import { xmlEscape as h } from "../twiml";
import { logger } from "../logger";

const wantsEmail = (m: string) => m === "email" || m === "both";
const wantsSms = (m: string) => m === "sms" || m === "both";

/** „Ihr Techniker ist unterwegs“ an den Kunden (Einstellung contact.enRoute), höchstens einmal je Einsatz. */
export async function onJobEnRoute(tenantId: string, ticketId: string, employeeName: string) {
  const t = await prisma.callTicket.findFirst({ where: { id: ticketId, tenantId }, include: { customer: true, tenant: true } });
  if (!t) return { sent: false };
  const cfg = resolveConfig(t.tenant);
  const mode = cfg.settings.contact.enRoute;
  if (mode === "off") return { sent: false };
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
 * Bitte um Bewertung nach Abschluss (Einstellung contact.reviewRequest, Verzögerung reviewDelayHours).
 * Je Kunde höchstens alle 90 Tage; ältere Abschlüsse (> 7 Tage) werden nur noch als erledigt markiert.
 */
export async function runReviewRequests(now = new Date()) {
  const due = await prisma.jobReport.findMany({
    where: { status: "DONE", reviewHandledAt: null, finishedAt: { not: null, lte: now }, tenant: { status: { not: "PAUSED" } } },
    include: { tenant: true, ticket: { include: { customer: true } }, employee: { select: { name: true } } },
    orderBy: { finishedAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const r of due) {
    const cfg = resolveConfig(r.tenant);
    const c = cfg.settings.contact;
    const ageH = (now.getTime() - r.finishedAt!.getTime()) / 3600_000;
    if (c.reviewRequest !== "off" && c.reviewUrl && ageH < c.reviewDelayHours) continue;
    const customer = r.ticket.customer;
    const recent = customer.reviewRequestedAt && now.getTime() - customer.reviewRequestedAt.getTime() < 90 * 86400_000;
    let any = false;
    if (c.reviewRequest !== "off" && c.reviewUrl && ageH <= 7 * 24 && !recent) {
      const plan = (await planForTenant(r.tenantId)).plan;
      if (wantsSms(c.reviewRequest) && hasFeature(plan, "sms") && !customer.smsOptOutAt) {
        await sendSms({ tenantId: r.tenantId, ticketId: r.ticketId, to: customer.phone, body: `${r.tenant.name}: Danke für Ihren Auftrag! Waren Sie zufrieden? Über eine kurze Bewertung freuen wir uns: ${c.reviewUrl}`, purpose: "REVIEW_REQUEST" });
        any = true;
      }
      if (wantsEmail(c.reviewRequest) && customer.email && hasFeature(plan, "email_notifications")) {
        const html = emailLayout(`<p>${customer.name ? `Guten Tag ${h(customer.name)},` : "Guten Tag,"}</p><p>vielen Dank für Ihren Auftrag${r.employee ? ` – ${h(r.employee.name.split(/\s+/)[0])} war gerne bei Ihnen` : ""}.</p><p>Waren Sie zufrieden? Über eine kurze Bewertung freuen wir uns sehr:</p><p><a href="${h(c.reviewUrl)}">Jetzt bewerten</a></p><p>Mit freundlichen Grüßen<br/>${h(r.tenant.name)}</p>`, h(r.tenant.name));
        await sendEmail({ tenantId: r.tenantId, ticketId: r.ticketId, to: customer.email, subject: `Wie zufrieden waren Sie mit ${r.tenant.name}?`, html, purpose: "REVIEW_REQUEST", fromName: r.tenant.name });
        any = true;
      }
      if (any) await prisma.customer.update({ where: { id: customer.id }, data: { reviewRequestedAt: now } });
    }
    await prisma.jobReport.update({ where: { id: r.id }, data: { reviewHandledAt: now } });
    if (any) sent++;
  }
  if (sent) logger.info("reviews.sent", { sent });
  return { checked: due.length, sent };
}
