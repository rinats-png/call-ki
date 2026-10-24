import { prisma } from "../db";
import { env } from "../env";

type TwilioNumber = { phone_number: string; voice_url: string | null; voice_fallback_url: string | null };

/**
 * Prüft die Konfiguration der Rufnummern im Twilio-Konto gegen unsere Zuordnung:
 * Anrufziel zeigt auf unsere App, Ersatzziel („Primary handler fails“) ist gesetzt und liegt
 * NICHT auf unserem eigenen Server, Weiterleitungsnummer vorhanden. Gibt Probleme als Text zurück.
 */
export async function checkTwilioNumbers(): Promise<{ checked: number; problems: string[] } | null> {
  const e = env();
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN) return null;
  const ours = await prisma.phoneNumber.findMany({ select: { e164: true, fallbackNumber: true, tenant: { select: { name: true } } } });
  if (!ours.length) return { checked: 0, problems: [] };

  const auth = "Basic " + Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
  const remote = new Map<string, TwilioNumber>();
  let url: string | null = `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=1000`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Twilio HTTP ${res.status}`);
    const json = (await res.json()) as { incoming_phone_numbers: TwilioNumber[]; next_page_uri: string | null };
    for (const n of json.incoming_phone_numbers) remote.set(n.phone_number, n);
    url = json.next_page_uri ? `https://api.twilio.com${json.next_page_uri}` : null;
  }

  const ownHost = e.PUBLIC_BASE_URL ? new URL(e.PUBLIC_BASE_URL).host : null;
  const host = (u: string | null) => {
    try {
      return u ? new URL(u).host : null;
    } catch {
      return null;
    }
  };
  const problems: string[] = [];
  for (const n of ours) {
    const label = `${n.e164} (${n.tenant.name})`;
    const r = remote.get(n.e164);
    if (!r) {
      problems.push(`${label}: nicht im Twilio-Konto`);
      continue;
    }
    if (!r.voice_url || !/\/api\/twilio\/voice\b/.test(r.voice_url) || (ownHost && host(r.voice_url) !== ownHost)) problems.push(`${label}: Anrufziel zeigt nicht auf die App`);
    if (!r.voice_fallback_url) problems.push(`${label}: kein Ersatzziel („Primary handler fails“)`);
    else if (ownHost && host(r.voice_fallback_url) === ownHost) problems.push(`${label}: Ersatzziel liegt auf dem eigenen Server und fällt mit ihm aus`);
    if (!n.fallbackNumber) problems.push(`${label}: keine Weiterleitungsnummer für Störungen`);
  }
  return { checked: ours.length, problems };
}
