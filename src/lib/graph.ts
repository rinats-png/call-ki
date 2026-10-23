import { env, microsoftConfigured } from "./env";
import { toGraphLocal, type Interval } from "./time";

/**
 * Microsoft Graph – EINE mandantenfähige Entra-App der Plattform.
 * Jeder Kunde erteilt per Admin-Consent Zugriff für SEIN Microsoft-365; danach
 * holt die Plattform per Client Credentials Tokens für dessen Microsoft-Tenant-ID.
 * Es werden keine Kunden-Secrets gespeichert.
 *
 * Application Permissions der App: Calendars.ReadWrite, Mail.ReadWrite (Admin Consent).
 */
const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";
const TIMEOUT_MS = 8000;

export class GraphError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(msTenantId: string): Promise<string> {
  const hit = tokenCache.get(msTenantId);
  if (hit && hit.expiresAt - 60_000 > Date.now()) return hit.token;
  const e = env();
  const res = await fetch(`${LOGIN}/${encodeURIComponent(msTenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.MS_CLIENT_ID!, client_secret: e.MS_CLIENT_SECRET!, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new GraphError(`Microsoft-Anmeldung fehlgeschlagen: ${json.error_description?.split("\r\n")[0] ?? res.statusText}`, res.status, json);
  tokenCache.set(msTenantId, { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

async function graphFetch<T>(msTenantId: string, path: string, init: RequestInit & { headers?: Record<string, string> } = {}, attempt = 0): Promise<T> {
  const token = await getAccessToken(msTenantId);
  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    // Kurzes Timeout: Die Sprach-KI wartet im Gespräch auf die Antwort
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 3) * 1000));
    return graphFetch<T>(msTenantId, path, init, attempt + 1);
  }
  if (res.status === 401 && attempt === 0) {
    tokenCache.delete(msTenantId);
    return graphFetch<T>(msTenantId, path, init, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new GraphError(`Microsoft ${init.method ?? "GET"}: ${msg}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

/** URL für den Admin-Consent des Kunden (Microsoft-Admin des Kunden muss zustimmen). */
export function adminConsentUrl(state: string): string {
  const e = env();
  const p = new URLSearchParams({
    client_id: e.MS_CLIENT_ID!,
    scope: "https://graph.microsoft.com/.default",
    redirect_uri: `${e.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/integrations/microsoft/callback`,
    state,
  });
  return `${LOGIN}/organizations/v2.0/adminconsent?${p}`;
}

export async function testMailbox(msTenantId: string, mailbox: string): Promise<void> {
  await graphFetch(msTenantId, `/users/${enc(mailbox)}/calendar?$select=id`);
}

export async function getBusyIntervals(msTenantId: string, mailbox: string, from: Date, to: Date): Promise<Interval[]> {
  type Ev = { start: { dateTime: string }; end: { dateTime: string }; showAs?: string; isCancelled?: boolean };
  const out: Interval[] = [];
  let next: string | null =
    `/users/${enc(mailbox)}/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$select=start,end,showAs,isCancelled&$top=100`;
  while (next) {
    const page: { value: Ev[]; "@odata.nextLink"?: string } = await graphFetch(msTenantId, next, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    for (const ev of page.value) {
      if (ev.isCancelled || ev.showAs === "free") continue;
      out.push({ start: new Date(ev.start.dateTime + "Z"), end: new Date(ev.end.dateTime + "Z") });
    }
    next = page["@odata.nextLink"] ?? null;
  }
  return out;
}

export async function createCalendarEvent(msTenantId: string, input: {
  mailbox: string; subject: string; bodyHtml: string; start: Date; end: Date; timeZone: string; location?: string; urgent?: boolean; transactionId?: string;
}): Promise<{ id: string }> {
  return graphFetch(msTenantId, `/users/${enc(input.mailbox)}/events`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: input.bodyHtml },
      start: { dateTime: toGraphLocal(input.start, input.timeZone), timeZone: input.timeZone },
      end: { dateTime: toGraphLocal(input.end, input.timeZone), timeZone: input.timeZone },
      location: input.location ? { displayName: input.location } : undefined,
      importance: input.urgent ? "high" : "normal",
      showAs: "busy",
      isReminderOn: true,
      reminderMinutesBeforeStart: 30,
      categories: ["KI-Telefonzentrale"],
      transactionId: input.transactionId, // idempotent bei Retries
    }),
  });
}

export async function createMailDraft(msTenantId: string, input: { mailbox: string; to: string[]; cc?: string[]; subject: string; bodyHtml: string; urgent?: boolean }): Promise<{ id: string }> {
  return graphFetch(msTenantId, `/users/${enc(input.mailbox)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      importance: input.urgent ? "high" : "normal",
      body: { contentType: "HTML", content: input.bodyHtml },
      toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: (input.cc ?? []).map((address) => ({ emailAddress: { address } })),
      categories: ["KI-Telefonzentrale"],
    }),
  });
}

export { microsoftConfigured };
