import type { Call } from "@prisma/client";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Löschung von Gesprächsdaten bei den Anbietern (DSGVO: Löschfrist & Löschanspruch
 * gelten auch für Kopien bei Auftragsverarbeitern).
 *  - Retell: DELETE /v2/delete-call/{call_id} – entfernt Aufnahme, Transkript, Analyse
 *  - Twilio: Mailbox-Aufnahme (Recording) und Anrufprotokoll (Call) löschen
 */
const twilioAuth = () => {
  const e = env();
  return e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN ? "Basic " + Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64") : null;
};

/** 2xx oder 404/422 (bereits gelöscht/unbekannt) gelten als erledigt. */
const done = (status: number) => (status >= 200 && status < 300) || status === 404 || status === 422;

async function del(url: string, auth: string): Promise<number> {
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: auth }, signal: AbortSignal.timeout(10_000) });
  return res.status;
}

export type PurgeResult = { ok: boolean; details: string[] };

export async function purgeCallAtProviders(call: Pick<Call, "provider" | "providerCallId" | "twilioCallSid" | "recordingUrl">): Promise<PurgeResult> {
  const e = env();
  const details: string[] = [];
  let ok = true;

  if (call.provider === "retell" && call.providerCallId) {
    if (!e.RETELL_API_KEY) {
      ok = false;
      details.push("retell: kein API-Schlüssel");
    } else {
      try {
        const s = await del(`https://api.retellai.com/v2/delete-call/${encodeURIComponent(call.providerCallId)}`, `Bearer ${e.RETELL_API_KEY}`);
        details.push(`retell: ${s}`);
        ok &&= done(s);
      } catch (err) {
        ok = false;
        details.push(`retell: ${(err as Error).message}`);
      }
    }
  }

  const auth = twilioAuth();
  const recSid = call.recordingUrl?.match(/\/Recordings\/(RE[0-9a-f]{32})/i)?.[1];
  if (recSid || call.twilioCallSid) {
    if (!auth) {
      ok = false;
      details.push("twilio: keine Zugangsdaten");
    } else {
      const base = `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}`;
      for (const [label, url] of [
        ["twilio-recording", recSid ? `${base}/Recordings/${recSid}.json` : null],
        ["twilio-call", call.twilioCallSid ? `${base}/Calls/${call.twilioCallSid}.json` : null],
      ] as const) {
        if (!url) continue;
        try {
          const s = await del(url, auth);
          details.push(`${label}: ${s}`);
          ok &&= done(s);
        } catch (err) {
          ok = false;
          details.push(`${label}: ${(err as Error).message}`);
        }
      }
    }
  }

  if (!ok) logger.warn("provider.purge_incomplete", { details });
  return { ok, details };
}

/** Darf diese Aufnahme-URL abgerufen werden? (HTTPS + Host-Allowlist, Schutz vor SSRF) */
export function recordingUrlAllowed(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return env()
      .RECORDING_HOSTS.split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Abruf einer Aufnahme beim Anbieter (Twilio-Aufnahmen mit Zugangsdaten). */
export async function fetchRecording(raw: string): Promise<Response> {
  const isTwilio = /(^|\.)twilio\.com$/i.test(new URL(raw).hostname);
  const url = isTwilio && !/\.(mp3|wav)$/i.test(raw) ? `${raw}.mp3` : raw;
  const auth = isTwilio ? twilioAuth() : null;
  return fetch(url, { headers: auth ? { Authorization: auth } : undefined, signal: AbortSignal.timeout(20_000), redirect: "follow" });
}
