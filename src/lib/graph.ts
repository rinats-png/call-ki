import { env, graphConfigured } from "./env";
import { computeFreeSlots, toGraphLocal, type Interval } from "./time";
import { logger } from "./logger";

/**
 * Microsoft Graph Client (App-Only / Client Credentials Flow).
 *
 * Benötigte Application Permissions (Admin Consent):
 *   - Calendars.ReadWrite   (Termine im Kalender der Techniker anlegen / Verfügbarkeit lesen)
 *   - Mail.ReadWrite        (E-Mail-Entwürfe im Postfach anlegen)
 * Empfehlung: Zugriff per Exchange "Application Access Policy" bzw. RBAC for Applications
 * auf die Postfächer der Storm GmbH beschränken.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
  }
}

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - 60_000 > Date.now()) return tokenCache.token;
  const e = env();
  const res = await fetch(`https://login.microsoftonline.com/${e.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.MS_CLIENT_ID!,
      client_secret: e.MS_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new GraphError(`Token-Anforderung fehlgeschlagen: ${json.error_description ?? res.statusText}`, res.status, json);
  }
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function graphFetch<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}, attempt = 0): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });

  // Throttling / transiente Fehler: Retry mit Retry-After bzw. Backoff
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
    return graphFetch<T>(path, init, attempt + 1);
  }
  if (res.status === 401 && attempt === 0) {
    tokenCache = null;
    return graphFetch<T>(path, init, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new GraphError(`Graph ${init.method ?? "GET"} ${path}: ${msg}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const enc = encodeURIComponent;

// ---------------------------------------------------------------- Kalender

export async function getBusyIntervals(upn: string, from: Date, to: Date): Promise<Interval[]> {
  type Ev = { start: { dateTime: string }; end: { dateTime: string }; showAs?: string; isCancelled?: boolean };
  const out: Interval[] = [];
  let next: string | null =
    `/users/${enc(upn)}/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}` +
    `&$select=start,end,showAs,isCancelled&$top=100`;
  while (next) {
    const page: { value: Ev[]; "@odata.nextLink"?: string } = await graphFetch(next, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    for (const ev of page.value) {
      if (ev.isCancelled || ev.showAs === "free") continue;
      out.push({ start: new Date(ev.start.dateTime + "Z"), end: new Date(ev.end.dateTime + "Z") });
    }
    const link = page["@odata.nextLink"];
    next = link ? link.replace(GRAPH, "") : null;
  }
  return out;
}

export async function findAvailableSlots(upn: string, opts: { from?: Date; days?: number; max?: number; urgent?: boolean } = {}): Promise<Interval[]> {
  const e = env();
  const from = opts.from ?? new Date();
  const days = opts.days ?? 7;
  const to = new Date(from.getTime() + (days + 1) * 86400000);
  const busy = graphConfigured() ? await getBusyIntervals(upn, from, to) : [];
  return computeFreeSlots({
    from, days, busy,
    durationMin: e.APPOINTMENT_DURATION_MIN,
    startHour: e.BUSINESS_HOURS_START,
    endHour: e.BUSINESS_HOURS_END,
    timeZone: e.BUSINESS_TIMEZONE,
    max: opts.max ?? 3,
    leadMinutes: opts.urgent ? 60 : 120,
  });
}

export type CreatedEvent = { id: string; webLink?: string; dryRun?: boolean };

export async function createCalendarEvent(input: {
  upn: string;
  subject: string;
  bodyHtml: string;
  start: Date;
  end: Date;
  location?: string;
  urgent?: boolean;
  categories?: string[];
  transactionId?: string;
}): Promise<CreatedEvent> {
  const tz = env().BUSINESS_TIMEZONE;
  if (!graphConfigured()) {
    logger.warn("graph.dry_run", { action: "createEvent", upn: input.upn, subject: input.subject });
    return { id: `dryrun-event-${Date.now()}`, dryRun: true };
  }
  const ev = await graphFetch<{ id: string; webLink?: string }>(`/users/${enc(input.upn)}/events`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: input.bodyHtml },
      start: { dateTime: toGraphLocal(input.start, tz), timeZone: tz },
      end: { dateTime: toGraphLocal(input.end, tz), timeZone: tz },
      location: input.location ? { displayName: input.location } : undefined,
      importance: input.urgent ? "high" : "normal",
      showAs: "busy",
      isReminderOn: true,
      reminderMinutesBeforeStart: 30,
      categories: input.categories ?? ["KI-Telefonzentrale"],
      // transactionId macht den POST idempotent (Schutz vor doppelten Terminen bei Retries)
      transactionId: input.transactionId,
    }),
  });
  return { id: ev.id, webLink: ev.webLink };
}

// ---------------------------------------------------------------- E-Mail-Entwürfe

export type CreatedDraft = { id: string; webLink?: string; dryRun?: boolean };

export async function createMailDraft(input: {
  mailbox: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  urgent?: boolean;
}): Promise<CreatedDraft> {
  if (!graphConfigured()) {
    logger.warn("graph.dry_run", { action: "createDraft", mailbox: input.mailbox, subject: input.subject });
    return { id: `dryrun-draft-${Date.now()}`, dryRun: true };
  }
  const msg = await graphFetch<{ id: string; webLink?: string }>(`/users/${enc(input.mailbox)}/messages`, {
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
  return { id: msg.id, webLink: msg.webLink };
}

/** Verbindungstest für das Dashboard. */
export async function graphHealth(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  if (!graphConfigured()) return { configured: false, ok: false };
  try {
    await getAccessToken();
    return { configured: true, ok: true };
  } catch (err) {
    return { configured: true, ok: false, error: (err as Error).message };
  }
}
