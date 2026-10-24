import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../db";
import { env, smsConfigured, smtpConfigured } from "../env";
import { logger } from "../logger";
import { overlayVersion } from "../platform/overlay";

/**
 * Ausgehende Benachrichtigungen. Jede Nachricht wird im Protokoll (Message)
 * gespeichert – auch ohne konfigurierten Versanddienst (Status SKIPPED), damit
 * im Dashboard sichtbar ist, was rausgegangen wäre.
 */
export type Purpose = "CUSTOMER_CONFIRMATION" | "TECHNICIAN_BRIEFING" | "EMERGENCY_ALERT" | "INVITE" | "PASSWORD_RESET" | "BACKOFFICE_COPY" | "PLATFORM_ALERT";

let transport: Transporter | null = null;
let transportVersion = -1;
/** SMTP-Verbindung; wird neu aufgebaut, sobald sich Einstellungen in der Oberfläche ändern. */
export function mailer() {
  if (!transport || transportVersion !== overlayVersion()) {
    transportVersion = overlayVersion();
    const e = env();
    transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transport;
}

type EmailMeta = { replyTo?: string; fromName?: string; ics?: { filename: string; content: string } };

/** Höchstens so viele Zustellversuche (erster Versand eingeschlossen) */
export const MAX_ATTEMPTS = 5;
/** Wartezeit vor dem n-ten Wiederholungsversuch; Notfall-Alarme deutlich schneller */
const BACKOFF_MIN = [2, 10, 30, 120];
const BACKOFF_EMERGENCY_MIN = [1, 2, 5, 10];

/** Nächster Versuch nach einem Fehlschlag oder null, wenn aufgegeben wird */
export function nextAttemptAfter(attempts: number, purpose: string, now = Date.now()): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const table = purpose === "EMERGENCY_ALERT" ? BACKOFF_EMERGENCY_MIN : BACKOFF_MIN;
  return new Date(now + table[Math.min(attempts - 1, table.length - 1)] * 60_000);
}

async function markFailed(msg: { id: string; attempts: number; purpose: string }, provider: string, err: Error) {
  const attempts = msg.attempts + 1;
  const next = nextAttemptAfter(attempts, msg.purpose);
  await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED", provider, attempts, nextAttemptAt: next, error: err.message.slice(0, 500) } });
  if (!next) logger.error("message.gave_up", { messageId: msg.id, purpose: msg.purpose, attempts });
}

/** Versendet eine gespeicherte E-Mail (erster Versuch und Wiederholungen). */
async function deliverEmail(msg: { id: string; recipient: string; subject: string | null; body: string; purpose: string; attempts: number; meta: unknown }) {
  if (!smtpConfigured()) {
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SKIPPED", error: "SMTP nicht konfiguriert", nextAttemptAt: null } });
    return "SKIPPED" as const;
  }
  const meta = (msg.meta ?? {}) as EmailMeta;
  try {
    const from = env().SMTP_FROM!;
    await mailer().sendMail({
      from: meta.fromName ? `"${meta.fromName.replace(/"/g, "")}" <${from.match(/<(.+)>/)?.[1] ?? from}>` : from,
      to: msg.recipient,
      replyTo: meta.replyTo,
      subject: msg.subject ?? "",
      html: msg.body,
      icalEvent: meta.ics ? { filename: meta.ics.filename, method: "PUBLISH", content: meta.ics.content } : undefined,
    });
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SENT", provider: "smtp", attempts: msg.attempts + 1, nextAttemptAt: null, error: null } });
    return "SENT" as const;
  } catch (err) {
    logger.error("email.failed", { purpose: msg.purpose, attempt: msg.attempts + 1, error: (err as Error).message });
    await markFailed(msg, "smtp", err as Error);
    return "FAILED" as const;
  }
}

/** Versendet eine gespeicherte SMS über Twilio (erster Versuch und Wiederholungen). */
async function deliverSms(msg: { id: string; recipient: string; body: string; purpose: string; attempts: number }) {
  if (!smsConfigured()) {
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SKIPPED", error: "SMS-Versand nicht konfiguriert", nextAttemptAt: null } });
    return "SKIPPED" as const;
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
      body: new URLSearchParams({ To: msg.recipient, Body: msg.body.slice(0, 1500), ...(from.startsWith("MG") ? { MessagingServiceSid: from } : { From: from }) }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
    await prisma.message.update({ where: { id: msg.id }, data: { status: "SENT", provider: "twilio", attempts: msg.attempts + 1, nextAttemptAt: null, error: null } });
    return "SENT" as const;
  } catch (err) {
    logger.error("sms.failed", { purpose: msg.purpose, attempt: msg.attempts + 1, error: (err as Error).message });
    await markFailed(msg, "twilio", err as Error);
    return "FAILED" as const;
  }
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
  const meta: EmailMeta = { replyTo: m.replyTo, fromName: m.fromName, ics: m.ics };
  const msg = await prisma.message.create({
    data: { tenantId: m.tenantId ?? null, ticketId: m.ticketId ?? null, channel: "EMAIL", recipient: m.to, subject: m.subject, body: m.html, purpose: m.purpose, status: "QUEUED", meta },
  });
  if (!smtpConfigured()) logger.warn("email.skipped_no_smtp", { purpose: m.purpose });
  return { id: msg.id, status: await deliverEmail(msg) };
}

export async function sendSms(m: { tenantId: string | null; ticketId?: string | null; to: string; body: string; purpose: Purpose }) {
  const msg = await prisma.message.create({
    data: { tenantId: m.tenantId, ticketId: m.ticketId ?? null, channel: "SMS", recipient: m.to, body: m.body, purpose: m.purpose, status: "QUEUED" },
  });
  return { id: msg.id, status: await deliverSms(msg) };
}

/**
 * Wiederholt fällige, fehlgeschlagene Nachrichten (Cron, jede Minute). Nachrichten, die beim
 * Versand hängen geblieben sind (QUEUED, z. B. Neustart mitten im Versand), gelten nach
 * 10 Minuten ebenfalls als fehlgeschlagen. Jede Nachricht wird per bedingtem Update genau
 * einmal beansprucht, auch wenn zwei Läufe gleichzeitig starten.
 */
export async function retryDueMessages(limit = 50, now = new Date()) {
  await prisma.message.updateMany({
    where: { status: "QUEUED", createdAt: { lt: new Date(now.getTime() - 10 * 60_000) }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "FAILED", nextAttemptAt: now, error: "Versand unterbrochen" },
  });
  const due = await prisma.message.findMany({
    where: { status: "FAILED", nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }],
    take: limit,
  });
  const out = { due: due.length, sent: 0, failed: 0, skipped: 0 };
  for (const m of due) {
    const claimed = await prisma.message.updateMany({ where: { id: m.id, status: "FAILED", nextAttemptAt: m.nextAttemptAt }, data: { status: "QUEUED", nextAttemptAt: null } });
    if (!claimed.count) continue;
    const r = m.channel === "SMS" ? await deliverSms(m) : await deliverEmail(m);
    if (r === "SENT") out.sent++;
    else if (r === "FAILED") out.failed++;
    else out.skipped++;
  }
  return out;
}

/** HTML-Grundgerüst für alle E-Mails */
export function emailLayout(inner: string, footer: string) {
  return (
    `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1f2530;line-height:1.55;max-width:600px">${inner}` +
    `<p style="margin-top:28px;color:#6b7484;font-size:12px">${footer}</p></div>`
  );
}
