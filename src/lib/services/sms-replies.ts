import { prisma } from "../db";
import { logger } from "../logger";
import { emailLayout, sendEmail, sendSms } from "../notify";
import { resolveConfig } from "../tenant/settings";
import { formatGermanDateTime } from "../time";
import { xmlEscape as h } from "../twiml";
import { normalizePhone } from "../phone";

export type ReplyIntent = "YES" | "NO" | "STOP" | "OTHER";

/** Antwort auf „Passt es noch?“ deuten (deutsch, tolerant gegen Satzzeichen und Emojis). */
export function replyIntent(body: string): ReplyIntent {
  const t = body.trim().toLowerCase().replace(/[^a-zäöüß ]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(stop|stopp|abmelden|abbestellen|keine sms)\b/.test(t)) return "STOP";
  if (/^(ja|jo|jep|jawohl|ok|okay|passt|klar|gerne|gern|bestätigt|bestaetigt|in ordnung|alles klar|y|yes)\b/.test(t)) return "YES";
  if (/^(nein|ne|nee|nö|passt nicht|absagen|abgesagt|verschieben|geht nicht|klappt nicht|no)\b/.test(t)) return "NO";
  return "OTHER";
}

/**
 * Eingehende SMS an die Plattform-Absendernummer: Zuordnung über die letzte Termin-Erinnerung
 * an diese Nummer (max. 4 Tage alt). JA bestätigt, NEIN meldet ans Büro, STOP widerspricht.
 */
export async function handleInboundSms(fromRaw: string, body: string, now = new Date()) {
  const from = normalizePhone(fromRaw) ?? fromRaw;
  const intent = replyIntent(body);
  const last = await prisma.message.findFirst({
    where: { channel: "SMS", recipient: from, purpose: "APPOINTMENT_REMINDER", ticketId: { not: null }, createdAt: { gte: new Date(now.getTime() - 4 * 86400_000) } },
    orderBy: { createdAt: "desc" },
    select: { tenantId: true, ticketId: true },
  });
  if (intent === "STOP") {
    // Twilio selbst sperrt bei STOP ebenfalls; hier für alle Betriebe vermerken, die diese Nummer kennen
    await prisma.customer.updateMany({ where: { phone: from, smsOptOutAt: null }, data: { smsOptOutAt: now } });
    return { intent, matched: !!last };
  }
  if (!last?.ticketId || !last.tenantId) {
    logger.info("sms.inbound_unmatched", { intent });
    return { intent, matched: false };
  }
  const t = await prisma.callTicket.findFirst({ where: { id: last.ticketId, tenantId: last.tenantId }, include: { customer: true, tenant: true, assignedEmployee: true } });
  if (!t || !t.appointmentStart) return { intent, matched: false };
  const cfg = resolveConfig(t.tenant);
  const n = cfg.settings.notifications;
  const when = formatGermanDateTime(t.appointmentStart, t.tenant.timezone);
  const who = t.customer.name || t.customer.companyName || t.customer.phone;
  const quoted = body.trim().slice(0, 300);

  if (intent === "YES") {
    await prisma.callTicket.update({ where: { id: t.id }, data: { confirmation: "CONFIRMED", confirmationAt: now } });
    await sendSms({ tenantId: t.tenantId, ticketId: t.id, to: from, body: `${t.tenant.name}: Danke, Ihr Termin am ${when} ist bestätigt.`, purpose: "JOB_UPDATE" });
  } else if (intent === "NO") {
    await prisma.callTicket.update({ where: { id: t.id }, data: { confirmation: "DECLINED", confirmationAt: now, status: t.status === "CLOSED" ? t.status : "ESCALATED", notes: [t.notes, `SMS ${now.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}: Termin passt nicht („${quoted}“)`].filter(Boolean).join("\n").slice(0, 8000) } });
    const phone = n.contactPhone;
    await sendSms({ tenantId: t.tenantId, ticketId: t.id, to: from, body: `${t.tenant.name}: Danke für die Info. Wir melden uns für einen neuen Termin.${phone ? ` Oder rufen Sie an – auch nachts: ${phone}.` : ""}`, purpose: "JOB_UPDATE" });
  } else {
    await prisma.callTicket.update({ where: { id: t.id }, data: { notes: [t.notes, `SMS ${now.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}: „${quoted}“`].filter(Boolean).join("\n").slice(0, 8000) } });
  }
  if (intent !== "YES" && n.backofficeEmail) {
    const html = emailLayout(`<p>${h(who)} hat auf die Terminerinnerung (${h(when)}${t.assignedEmployee ? `, ${h(t.assignedEmployee.name)}` : ""}) geantwortet:</p><blockquote>${h(quoted)}</blockquote>${intent === "NO" ? "<p><b>Der Termin passt nicht.</b> Bitte neuen Termin vereinbaren.</p>" : ""}`, `${h(t.tenant.name)} · Vorgang ${h(t.id.slice(-8).toUpperCase())}`);
    await sendEmail({ tenantId: t.tenantId, ticketId: t.id, to: n.backofficeEmail, subject: intent === "NO" ? `Termin passt nicht: ${who}, ${when}` : `SMS-Antwort von ${who}`, html, purpose: "BACKOFFICE_COPY" });
  }
  return { intent, matched: true, ticketId: t.id };
}
