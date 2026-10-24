import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";
import { HttpError } from "./http";
import { logger } from "./logger";

/**
 * Rate-Limiter (security/standardwerte.md §6).
 *  - hit/enforce: gleitendes Fenster im Prozessspeicher – für hohe Frequenz (Webhooks, API je Nutzer).
 *  - hitShared/enforceShared: in PostgreSQL, gemeinsam für alle Instanzen und über Neustarts
 *    hinweg – für sicherheitsrelevante Limits (Anmeldung, 2FA, Passwort-Reset, Re-Auth, Anrufer).
 */
type Bucket = number[];
const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of store) if (!v.length || now - v[v.length - 1] > 24 * 3600_000) store.delete(k);
}

export type Limit = { limit: number; windowMs: number };

/** Zählt einen Treffer. Gibt bei Überschreitung die Wartezeit in Sekunden zurück, sonst 0. */
export function hit(key: string, { limit, windowMs }: Limit, now = Date.now()): number {
  sweep(now);
  const arr = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    store.set(key, arr);
    return Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
  }
  arr.push(now);
  store.set(key, arr);
  return 0;
}

/** Wie hit(), wirft aber HTTP 429 mit Retry-After. */
export function enforce(key: string, l: Limit, message = "Zu viele Anfragen. Bitte versuchen Sie es später erneut.") {
  const wait = hit(key, l);
  if (wait > 0) {
    logger.warn("rate_limit.hit", { key: key.replace(/[^:]+$/, "…") });
    throw new HttpError(429, message, { retryAfter: wait });
  }
}

export function resetLimit(key: string) {
  store.delete(key);
}

/**
 * Gemeinsamer Zähler in PostgreSQL. Feste Fenster, gewichtet mit dem Vorfenster (Näherung an
 * ein gleitendes Fenster). Schlüssel werden gehasht gespeichert (keine IP-Adressen in der DB).
 * Ist die Datenbank nicht erreichbar, greift der Speicher-Limiter – niemand wird ausgesperrt.
 */
export async function hitShared(key: string, { limit, windowMs }: Limit, now = Date.now()): Promise<number> {
  const k = createHash("sha256").update(key).digest("hex").slice(0, 40);
  const ws = Math.floor(now / windowMs) * windowMs;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitHit" ("key", "windowStart", "count") VALUES (${k}, ${new Date(ws)}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitHit"."count" + 1
      RETURNING "count"`;
    const current = Number(rows[0]?.count ?? 1);
    const prev = await prisma.rateLimitHit.findUnique({ where: { key_windowStart: { key: k, windowStart: new Date(ws - windowMs) } }, select: { count: true } });
    const weight = 1 - (now - ws) / windowMs;
    const estimate = current - 1 + (prev?.count ?? 0) * weight; // Treffer vor diesem
    if (estimate >= limit) return Math.max(1, Math.ceil((ws + windowMs - now) / 1000));
    return 0;
  } catch (err) {
    logger.warn("rate_limit.shared_unavailable", { error: (err as Error).message });
    return hit(key, { limit, windowMs }, now);
  }
}

/** Wie hitShared(), wirft aber HTTP 429 mit Retry-After. */
export async function enforceShared(key: string, l: Limit, message = "Zu viele Anfragen. Bitte versuchen Sie es später erneut.") {
  const wait = await hitShared(key, l);
  if (wait > 0) {
    logger.warn("rate_limit.hit", { key: key.replace(/[^:]+$/, "…") });
    throw new HttpError(429, message, { retryAfter: wait });
  }
}

/** Alte Zähler entfernen (Löschfristen-Job). */
export async function purgeRateLimitHits(now = Date.now()) {
  return (await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: new Date(now - 2 * 24 * 3600_000) } } })).count;
}

/** Client-IP: Caddy setzt X-Forwarded-For auf die echte Adresse (eingehende Werte werden verworfen). */
export async function clientIp(req?: Request): Promise<string> {
  const h = req?.headers ?? (await headers());
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** Voreinstellungen (pro Konto und pro IP) */
export const LIMITS = {
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  resetPerIp: { limit: 10, windowMs: 3600_000 },
  resetPerAccount: { limit: 3, windowMs: 3600_000 },
  setupPerIp: { limit: 5, windowMs: 3600_000 },
  mfaPerSession: { limit: 5, windowMs: 10 * 60_000 },
  mfaPerIp: { limit: 20, windowMs: 15 * 60_000 },
  reauthPerUser: { limit: 5, windowMs: 15 * 60_000 },
  settingsTestPerUser: { limit: 30, windowMs: 10 * 60_000 },
  apiPerUser: { limit: 120, windowMs: 60_000 },
  webhookPerIp: { limit: 600, windowMs: 60_000 },
  /** Gleicher Anrufer an dieselbe Nummer (Spam/Kostenschutz) */
  callsPerCaller: { limit: 10, windowMs: 3600_000 },
  /** Alle Anrufe mit unterdrückter Nummer an dieselbe Nummer zusammen */
  anonymousCallsPerNumber: { limit: 30, windowMs: 3600_000 },
} satisfies Record<string, Limit>;
