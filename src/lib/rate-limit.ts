import { headers } from "next/headers";
import { HttpError } from "./http";
import { logger } from "./logger";

/**
 * Rate-Limiter mit gleitendem Fenster (security/standardwerte.md §6).
 * Speicher im Prozess – passend für den Betrieb als EINE Instanz (Docker auf dem VPS).
 * Für mehrere Instanzen den Store gegen Redis o. ä. tauschen (gleiche Schnittstelle).
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
} satisfies Record<string, Limit>;
