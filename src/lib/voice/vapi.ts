import { setting } from "../platform/config";
import { vapiSipHost, vapiSipUser } from "./handoff";

/**
 * Legt bei Vapi eine SIP-Nummer für eine Rufnummer der Plattform an (sip:ck{ziffern}@sip.vapi.ai).
 * Ohne festen Assistenten → Vapi fragt bei jedem Anruf per „assistant-request“ die Server-URL der
 * Organisation, die Firmendaten des Kunden liefert. Bereits vorhandene Nummern gelten als Erfolg.
 */
export async function ensureVapiSipNumber(e164: string): Promise<{ ok: boolean; message: string }> {
  const key = setting("VAPI_API_KEY");
  if (!key) return { ok: false, message: "Vapi ist nicht eingerichtet (API-Schlüssel fehlt)." };
  const sipUri = `sip:${vapiSipUser(e164)}@${vapiSipHost()}`;
  const res = await fetch(`${setting("VAPI_API_BASE") || "https://api.vapi.ai"}/phone-number`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "vapi", sipUri, name: `Plattform ${e164}` }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (res.ok) return { ok: true, message: `Vapi-SIP-Nummer ${sipUri} angelegt.` };
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  const text = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? "";
  if (res.status === 400 && /exist|already|taken/i.test(text)) return { ok: true, message: `Vapi-SIP-Nummer ${sipUri} ist bereits vorhanden.` };
  return { ok: false, message: `Vapi meldet ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
}
