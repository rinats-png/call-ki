import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import type { Call, CallTicket, Customer, Employee, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";
import { HttpError } from "../http";
import { runAfterResponse } from "../defer";
import { open, seal } from "../secret-box";
import { randomToken } from "../auth/crypto";
import { hasFeature, planForTenant } from "../billing";

/**
 * Webhooks für Kunden: Vorgänge und Anrufe an eigene Systeme (CRM, Zapier/Make, Warenwirtschaft).
 * Signatur je Endpunkt: `X-CallKI-Signature: t=<unix>,v1=<hex HMAC-SHA256("<t>.<body>", secret)>`.
 * Zustellung nach der Antwort, Wiederholung mit Pause über den Cron „notify“.
 */
export const WEBHOOK_EVENTS = ["ticket.created", "ticket.updated", "call.ended"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | "test";
export const MAX_ENDPOINTS = 5;
export const MAX_WEBHOOK_ATTEMPTS = 6;
const BACKOFF_MIN = [1, 5, 30, 120, 360];

/** Private, lokale und reservierte Adressen – dorthin wird nie zugestellt (SSRF-Schutz). */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

type Resolver = (host: string) => Promise<string[]>;
const resolveAll: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** Nur HTTPS, ohne Zugangsdaten in der URL, Ziel darf nicht ins interne Netz zeigen. */
export async function checkWebhookUrl(raw: string, resolve: Resolver = resolveAll): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "Ungültige Adresse.");
  }
  if (u.protocol !== "https:") throw new HttpError(400, "Nur https-Adressen sind erlaubt.");
  if (u.username || u.password) throw new HttpError(400, "Zugangsdaten gehören nicht in die Adresse.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new HttpError(400, "Interne Adressen sind nicht erlaubt.");
  const ips = net.isIP(host) ? [host] : await resolve(host).catch(() => [] as string[]);
  if (!ips.length) throw new HttpError(400, "Adresse nicht auflösbar.");
  if (ips.some(isPrivateAddress)) throw new HttpError(400, "Interne Adressen sind nicht erlaubt.");
  return u;
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Neuer Endpunkt; das Geheimnis wird nur dieses eine Mal im Klartext zurückgegeben. */
export async function createWebhook(tenantId: string, url: string, events: string[], resolve?: Resolver) {
  if (!hasFeature((await planForTenant(tenantId)).plan, "webhooks")) throw new HttpError(403, "Webhooks sind in Ihrem Paket nicht enthalten.");
  if ((await prisma.webhookEndpoint.count({ where: { tenantId } })) >= MAX_ENDPOINTS) throw new HttpError(400, `Höchstens ${MAX_ENDPOINTS} Webhooks.`);
  const u = await checkWebhookUrl(url, resolve);
  const evs = events.filter((e): e is (typeof WEBHOOK_EVENTS)[number] => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!evs.length) throw new HttpError(400, "Mindestens ein Ereignis wählen.");
  const secret = `whsec_${randomToken(24)}`;
  const ep = await prisma.webhookEndpoint.create({ data: { tenantId, url: u.toString(), events: evs, secretEnc: seal(secret) } });
  return { id: ep.id, secret };
}

type TicketFull = CallTicket & { customer: Customer; assignedEmployee: Employee | null };

export function ticketPayload(t: TicketFull) {
  return {
    id: t.id, reference: t.id.slice(-8).toUpperCase(), status: t.status, urgency: t.urgency, category: t.category, summary: t.summary,
    appointment: t.appointmentStart ? { start: t.appointmentStart.toISOString(), end: t.appointmentEnd?.toISOString() ?? null } : null,
    employee: t.assignedEmployee ? { id: t.assignedEmployee.id, name: t.assignedEmployee.name } : null,
    customer: { id: t.customer.id, name: t.customer.name, companyName: t.customer.companyName, phone: t.customer.phone, email: t.customer.email, address: t.customer.address, postalCode: t.customer.postalCode, type: t.customer.customerType },
    callId: t.callId, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  };
}

export function callPayload(c: Call) {
  return {
    id: c.id, from: c.fromNumber, to: c.toNumber, status: c.status, startedAt: c.startedAt.toISOString(), endedAt: c.endedAt?.toISOString() ?? null,
    durationSec: c.twilioDurationSec ?? c.durationSec ?? null, summary: c.summary, endReason: c.endReason, customerId: c.customerId,
  };
}

/** Ereignis an alle passenden Endpunkte des Kunden – Zustellung nach der Antwort. */
export async function emitWebhook(tenantId: string, event: Exclude<WebhookEvent, "test">, data: Prisma.InputJsonValue) {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { tenantId, active: true, events: { has: event } }, select: { id: true } });
  if (!endpoints.length) return 0;
  if (!hasFeature((await planForTenant(tenantId)).plan, "webhooks")) return 0;
  for (const ep of endpoints) {
    const d = await prisma.webhookDelivery.create({ data: { endpointId: ep.id, event, payload: data } });
    runAfterResponse("webhook.deliver", () => deliverWebhook(d.id));
  }
  return endpoints.length;
}

export async function deliverWebhook(deliveryId: string, deps: { fetch?: typeof fetch; resolve?: Resolver } = {}) {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!d || d.status === "SENT") return d?.status ?? "MISSING";
  const ep = d.endpoint;
  const body = JSON.stringify({ id: d.id, event: d.event, createdAt: d.createdAt.toISOString(), data: d.payload });
  const ts = Math.floor(Date.now() / 1000);
  let ok = false, status = "";
  try {
    const url = await checkWebhookUrl(ep.url, deps.resolve);
    const res = await (deps.fetch ?? fetch)(url, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", "User-Agent": "KI-Telefonzentrale-Webhook/1", "X-CallKI-Event": d.event, "X-CallKI-Delivery": d.id, "X-CallKI-Signature": signWebhook(open(ep.secretEnc), ts, body) },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    ok = res.status >= 200 && res.status < 300;
    status = `HTTP ${res.status}`;
  } catch (err) {
    status = (err as Error).message.slice(0, 200);
  }
  const attempts = d.attempts + 1;
  const giveUp = !ok && attempts >= MAX_WEBHOOK_ATTEMPTS;
  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: ok
      ? { status: "SENT", attempts, nextAttemptAt: null, lastError: null }
      : { status: "FAILED", attempts, lastError: status, nextAttemptAt: giveUp || d.event === "test" ? null : new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000) },
  });
  await prisma.webhookEndpoint.update({ where: { id: ep.id }, data: { lastStatus: ok ? "OK" : status, lastAt: new Date() } });
  if (!ok) logger.warn("webhook.failed", { tenantId: ep.tenantId, endpointId: ep.id, attempts, status });
  return ok ? "SENT" : "FAILED";
}

/** Cron (jede Minute): fällige Wiederholungen; jede Zustellung wird genau einmal beansprucht. */
export async function retryDueWebhooks(limit = 50, now = new Date()) {
  const due = await prisma.webhookDelivery.findMany({ where: { status: "FAILED", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  let sent = 0, failed = 0;
  for (const d of due) {
    const claimed = await prisma.webhookDelivery.updateMany({ where: { id: d.id, status: "FAILED", nextAttemptAt: d.nextAttemptAt }, data: { status: "QUEUED", nextAttemptAt: null } });
    if (!claimed.count) continue;
    if ((await deliverWebhook(d.id)) === "SENT") sent++;
    else failed++;
  }
  return { due: due.length, sent, failed };
}
