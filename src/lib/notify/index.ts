import nodemailer from "nodemailer";
import { prisma } from "../db";
import { env, smsConfigured, smtpConfigured } from "../env";
import { logger } from "../logger";

/**
 * Ausgehende Benachrichtigungen. Jede Nachricht wird im Protokoll (Message)
 * gespeichert – auch ohne konfigurierten Versanddienst (Status SKIPPED), damit
 * im Dashboard sichtbar ist, was rausgegangen wäre.
 */
export type Purpose = "CUSTOMER_CONFIRMATION" | "TECHNICIAN_BRIEFING" | "EMERGENCY_ALERT" | "INVITE" | "PASSWORD_RESET" | "BACKOFFICE_COPY";

let transport: nodemailer.Transporter | null = null;
function mailer() {
  if (!transport) {
    const e = env();
    transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function sendEmail(m: {
  tenantId?: string | null;
  ticketId?: string | null;
  to: string;
  subject: string;
  html: string;
  purpose: Purpose;
  replyTo?: string;
  fromName?: string;
  ics?: { filename: string; content: string };
}) {
  const msg = await prisma.message.create({
    data: { tenantId: m.tenantId ?? null, ticketId: m.ticketId ?? null, channel: "EMAIL", recipient: m.to, subject: m.subject, body: m.html, purpose: m.purpose, status: "QUEUED" },
  });
  if (!smtpConfigured()) {
    logger.warn("email.skipped_no_smtp", { purpose: m.purpose });
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SKIPPED", error: "SMTP nicht konfiguriert" } });
    return { id: msg.id, status: "SKIPPED" as const };
  }
  try {
    const from = env().SMTP_FROM!;
    await mailer().sendMail({
      from: m.fromName ? `"${m.fromName.replace(/"/g, "")}" <${from.match(/<(.+)>/)?.[1] ?? from}>` : from,
      to: m.to,
      replyTo: m.replyTo,
      subject: m.subject,
      html: m.html,
      icalEvent: m.ics ? { filename: m.ics.filename, method: "PUBLISH", content: m.ics.content } : undefined,
    });
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SENT", provider: "smtp" } });
    return { id: msg.id, status: "SENT" as const };
  } catch (err) {
    logger.error("email.failed", { purpose: m.purpose, error: (err as Error).message });
    await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED", provider: "smtp", error: (err as Error).message.slice(0, 500) } });
    return { id: msg.id, status: "FAILED" as const };
  }
}

export async function sendSms(m: { tenantId: string; ticketId?: string | null; to: string; body: string; purpose: Purpose }) {
  const msg = await prisma.message.create({
    data: { tenantId: m.tenantId, ticketId: m.ticketId ?? null, channel: "SMS", recipient: m.to, body: m.body, purpose: m.purpose, status: "QUEUED" },
  });
  if (!smsConfigured()) {
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SKIPPED", error: "SMS-Versand nicht konfiguriert" } });
    return { id: msg.id, status: "SKIPPED" as const };
  }
  const e = env();
  const from = e.TWILIO_SMS_FROM!;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: m.to, Body: m.body.slice(0, 1500), ...(from.startsWith("MG") ? { MessagingServiceSid: from } : { From: from }) }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SENT", provider: "twilio" } });
    return { id: msg.id, status: "SENT" as const };
  } catch (err) {
    logger.error("sms.failed", { purpose: m.purpose, error: (err as Error).message });
    await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED", provider: "twilio", error: (err as Error).message.slice(0, 500) } });
    return { id: msg.id, status: "FAILED" as const };
  }
}

/** HTML-Grundgerüst für alle E-Mails */
export function emailLayout(inner: string, footer: string) {
  return (
    `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1f2530;line-height:1.55;max-width:600px">${inner}` +
    `<p style="margin-top:28px;color:#6b7484;font-size:12px">${footer}</p></div>`
  );
}
