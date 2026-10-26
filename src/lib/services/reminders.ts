import { prisma } from "../db";
import { logger } from "../logger";
import { hasFeature, planForTenant } from "../billing";
import { hasModule } from "../addons";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { resolveConfig } from "../tenant/settings";
import { formatGermanDateTime } from "../time";
import { xmlEscape as h } from "../twiml";

/**
 * Terminerinnerungen an Kunden (Einstellung notifications.reminder, Stunden vorher
 * notifications.reminderHoursBefore). Läuft alle 15 Minuten. Termine, die erst innerhalb
 * des Erinnerungsfensters gebucht wurden, bekommen keine zusätzliche Erinnerung – die
 * Bestätigung genügt. Jeder Termin wird höchstens einmal erinnert (reminderSentAt).
 */
export async function runAppointmentReminders(now = new Date()) {
  const due = await prisma.callTicket.findMany({
    where: {
      reminderSentAt: null,
      status: { not: "CLOSED" },
      appointmentStart: { gt: now, lte: new Date(now.getTime() + 72 * 3600_000) },
      tenant: { status: { not: "PAUSED" } },
    },
    include: { customer: true, assignedEmployee: true, tenant: true },
    take: 200,
  });
  let sent = 0, skipped = 0;
  for (const t of due) {
    const cfg = resolveConfig(t.tenant);
    const n = cfg.settings.notifications;
    const start = t.appointmentStart!;
    const windowStart = new Date(start.getTime() - n.reminderHoursBefore * 3600_000);
    if (n.reminder === "off" || now < windowStart) continue;
    // Erst im Fenster gebucht/geändert → Bestätigung genügt
    if (t.updatedAt >= windowStart) {
      await prisma.callTicket.update({ where: { id: t.id }, data: { reminderSentAt: now } });
      skipped++;
      continue;
    }
    const plan = (await planForTenant(t.tenantId)).plan;
    const when = formatGermanDateTime(start, t.tenant.timezone);
    const phone = n.contactPhone || null;
    const change = phone ? ` Verschieben oder absagen: ${phone}.` : "";
    const noun = cfg.template.jobNoun;
    let any = false;
    if ((n.reminder === "email" || n.reminder === "both") && t.customer.email && hasFeature(plan, "email_notifications")) {
      const html = emailLayout(
        `<p>${t.customer.name ? `Guten Tag ${h(t.customer.name)},` : "Guten Tag,"}</p><p>wir erinnern Sie an Ihren ${h(noun)} am <b>${h(when)}</b>${t.assignedEmployee ? ` mit <b>${h(t.assignedEmployee.name)}</b>` : ""}.</p>` +
          (phone ? `<p>Passt es nicht mehr? Rufen Sie uns einfach an: <b>${h(phone)}</b> – Termin verschieben oder absagen geht auch telefonisch rund um die Uhr.</p>` : "") +
          `<p>Mit freundlichen Grüßen<br/>${h(t.tenant.name)}</p>`,
        `${h(t.tenant.name)} · Vorgangsnummer ${h(t.id.slice(-8).toUpperCase())}`,
      );
      await sendEmail({ tenantId: t.tenantId, ticketId: t.id, to: t.customer.email, subject: `Erinnerung: ${noun} am ${when}`, html, purpose: "APPOINTMENT_REMINDER", fromName: t.tenant.name, replyTo: n.backofficeEmail || undefined });
      any = true;
    }
    if ((n.reminder === "sms" || n.reminder === "both") && hasFeature(plan, "sms") && !t.customer.smsOptOutAt) {
      const ask = n.reminderAskConfirm && (await hasModule(t.tenantId, "customer_contact", now)) ? " Passt es noch? Antworten Sie mit JA oder NEIN." : "";
      await sendSms({ tenantId: t.tenantId, ticketId: t.id, to: t.customer.phone, body: `${t.tenant.name}: Erinnerung an Ihren Termin am ${when}.${ask}${change}`, purpose: "APPOINTMENT_REMINDER" });
      any = true;
    }
    await prisma.callTicket.update({ where: { id: t.id }, data: { reminderSentAt: now } });
    if (any) sent++;
    else skipped++;
  }
  if (sent) logger.info("reminders.sent", { sent, skipped });
  return { checked: due.length, sent, skipped };
}
