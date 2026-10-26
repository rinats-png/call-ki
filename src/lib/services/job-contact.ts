import { prisma } from "../db";
import { hasFeature, planForTenant } from "../billing";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { resolveConfig } from "../tenant/settings";
import { xmlEscape as h } from "../twiml";

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
