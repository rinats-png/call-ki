import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import { setting } from "./platform/config";
import { open, seal } from "./secret-box";
import type { Interval } from "./time";

/**
 * Google Kalender je Kunde (OAuth 2.0, Offline-Zugriff). Der Refresh-Token wird verschlüsselt in
 * Integration.secretEnc gespeichert; Zugriffstoken nur im Speicher.
 * Belegung: POST /calendar/v3/freeBusy · Termin: POST /calendar/v3/calendars/{id}/events
 * Kalender eines Mitarbeiters = seine E-Mail-Adresse (Google Workspace: verbindender Nutzer braucht Schreibrecht).
 */
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];
export const GOOGLE_TYPE = "GOOGLE_CALENDAR";

export const googleConfigured = () => !!(setting("GOOGLE_CLIENT_ID") && setting("GOOGLE_CLIENT_SECRET"));
const redirectUri = () => `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/api/integrations/google/callback`;

export function googleAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: setting("GOOGLE_CLIENT_ID")!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${p}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: setting("GOOGLE_CLIENT_ID")!, client_secret: setting("GOOGLE_CLIENT_SECRET")!, ...body }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || json.error) throw new Error(`Google: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

/** Code aus dem Rücksprung gegen Tokens tauschen. E-Mail des Kontos aus dem id_token (direkt von Google, über TLS). */
export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; email: string | null }> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google hat keinen Refresh-Token geliefert – bitte Zugriff unter myaccount.google.com/permissions entfernen und erneut verbinden.");
  let email: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from((t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string };
    email = payload.email ?? null;
  } catch {
    /* ohne E-Mail weiter */
  }
  return { refreshToken: t.refresh_token, email };
}

const cache = new Map<string, { token: string; exp: number }>();

async function accessToken(tenantId: string): Promise<string> {
  const c = cache.get(tenantId);
  if (c && c.exp > Date.now() + 60_000) return c.token;
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: GOOGLE_TYPE } } });
  if (!integ?.secretEnc || integ.status !== "CONNECTED") throw new Error("Google Kalender nicht verbunden");
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(integ.secretEnc) });
    cache.set(tenantId, { token: t.access_token!, exp: Date.now() + (t.expires_in ?? 3000) * 1000 });
    return t.access_token!;
  } catch (err) {
    // invalid_grant: Zugriff entzogen → Verbindung als gestört markieren
    await prisma.integration.update({ where: { id: integ.id }, data: { status: "ERROR", lastError: (err as Error).message.slice(0, 300) } });
    throw err;
  }
}

export async function googleLinked(tenantId: string): Promise<boolean> {
  if (!googleConfigured()) return false;
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: GOOGLE_TYPE } }, select: { status: true } });
  return integ?.status === "CONNECTED";
}

async function gfetch<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(tenantId)}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google ${init.method ?? "GET"} ${res.status}: ${json.error?.message ?? ""}`.trim());
  return json;
}

export async function googleBusy(tenantId: string, calendarId: string, from: Date, to: Date): Promise<Interval[]> {
  const r = await gfetch<{ calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> }>(tenantId, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] }),
  });
  const cal = r.calendars?.[calendarId];
  if (cal?.errors?.length) throw new Error(`Google-Kalender ${calendarId}: ${cal.errors.map((e) => e.reason).join(", ")}`);
  return (cal?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function googleCreateEvent(tenantId: string, calendarId: string, input: { subject: string; bodyText: string; start: Date; end: Date; location?: string | null; timeZone: string }): Promise<{ id: string }> {
  const r = await gfetch<{ id: string }>(tenantId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: input.subject,
      description: input.bodyText,
      location: input.location ?? undefined,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    }),
  });
  return { id: r.id };
}

/** Verbindung trennen: Token bei Google widerrufen (best effort) und lokal löschen. */
export async function disconnectGoogle(tenantId: string): Promise<void> {
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: GOOGLE_TYPE } } });
  if (integ?.secretEnc) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(open(integ.secretEnc))}`, { method: "POST", signal: AbortSignal.timeout(5000) });
    } catch (err) {
      logger.warn("google.revoke_failed", { tenantId, error: (err as Error).message });
    }
  }
  cache.delete(tenantId);
  await prisma.integration.deleteMany({ where: { tenantId, type: GOOGLE_TYPE } });
}

export const sealToken = seal;
