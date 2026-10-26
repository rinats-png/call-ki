import { env } from "../env";
import { mailer } from "../notify";
import { setting } from "./config";

export type TestResult = { ok: boolean; message: string };

async function getJson(url: string, headers: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

const httpMessage = (status: number) =>
  status === 401 || status === 403 ? "Zugang abgelehnt – Schlüssel prüfen." : status === 404 ? "Nicht gefunden – ID prüfen." : `Antwort ${status}.`;

/**
 * Prüft eine Anbieter-Verbindung mit einem lesenden Aufruf (es wird nichts verändert).
 * Ergebnistexte enthalten nie Schlüssel.
 */
export async function testProvider(id: string): Promise<TestResult> {
  try {
    switch (id) {
      case "retell": {
        const key = setting("RETELL_API_KEY");
        const agent = setting("RETELL_AGENT_ID");
        if (!key) return { ok: false, message: "API-Schlüssel fehlt." };
        const url = agent ? `https://api.retellai.com/get-agent/${encodeURIComponent(agent)}` : "https://api.retellai.com/list-agents";
        const r = await getJson(url, { Authorization: `Bearer ${key}` });
        if (r.status !== 200) return { ok: false, message: httpMessage(r.status) };
        return { ok: true, message: agent ? `Agent „${String(r.body.agent_name ?? agent)}“ gefunden.` : "Schlüssel gültig – bitte noch eine Agent-ID eintragen." };
      }
      case "vapi": {
        const key = setting("VAPI_API_KEY");
        const id = setting("VAPI_ASSISTANT_ID");
        if (!key) return { ok: false, message: "API-Schlüssel fehlt." };
        const r = await getJson(id ? `https://api.vapi.ai/assistant/${encodeURIComponent(id)}` : "https://api.vapi.ai/assistant?limit=1", { Authorization: `Bearer ${key}` });
        if (r.status !== 200) return { ok: false, message: httpMessage(r.status) };
        return { ok: true, message: id ? `Assistent „${String(r.body.name ?? id)}“ gefunden.` : "Schlüssel gültig – bitte noch eine Assistent-ID eintragen." };
      }
      case "elevenlabs": {
        const key = setting("ELEVENLABS_API_KEY");
        const agent = setting("ELEVENLABS_AGENT_ID");
        if (!key) return { ok: false, message: "API-Schlüssel fehlt." };
        const r = await getJson(agent ? `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agent)}` : "https://api.elevenlabs.io/v1/convai/agents?page_size=1", { "xi-api-key": key });
        if (r.status !== 200) return { ok: false, message: httpMessage(r.status) };
        return { ok: true, message: agent ? `Agent „${String(r.body.name ?? agent)}“ gefunden.` : "Schlüssel gültig – bitte noch eine Agent-ID eintragen." };
      }
      case "twilio": {
        const e = env();
        if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN) return { ok: false, message: "Account SID oder Auth Token fehlt." };
        const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
        const r = await getJson(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(e.TWILIO_ACCOUNT_SID)}.json`, { Authorization: `Basic ${auth}` });
        if (r.status !== 200) return { ok: false, message: httpMessage(r.status) };
        return { ok: true, message: `Konto „${String(r.body.friendly_name ?? "Twilio")}“, Status ${String(r.body.status ?? "unbekannt")}.` };
      }
      case "smtp": {
        if (!env().SMTP_HOST) return { ok: false, message: "Server fehlt." };
        await mailer().verify();
        return { ok: true, message: "Anmeldung am Mailserver erfolgreich." };
      }
      case "maps": {
        const { geoProvider } = await import("../geo");
        const p = geoProvider();
        if (!p) return { ok: false, message: setting("MAPS_PROVIDER") ? "Zugang unvollständig." : "Kein Anbieter gewählt – es wird aus der Luftlinie geschätzt." };
        if (p === "ors") {
          const u = new URL("https://api.openrouteservice.org/geocode/search");
          u.searchParams.set("api_key", setting("ORS_API_KEY")!);
          u.searchParams.set("text", "Marktplatz 1, 55116 Mainz");
          u.searchParams.set("size", "1");
          const r = await getJson(u.toString(), {});
          if (r.status !== 200) return { ok: false, message: httpMessage(r.status) };
          return { ok: true, message: "OpenRouteService antwortet (Testadresse in Mainz gefunden)." };
        }
        const r = await getJson(new URL("/status?format=json", setting("NOMINATIM_URL")!).toString(), {});
        if (r.status !== 200) return { ok: false, message: `Nominatim: ${httpMessage(r.status)}` };
        if (setting("OSRM_URL")) {
          const o = await getJson(new URL("/route/v1/driving/8.27,50.0;8.25,49.99?overview=false", setting("OSRM_URL")!).toString(), {});
          if (o.status !== 200) return { ok: false, message: `OSRM: ${httpMessage(o.status)}` };
        }
        return { ok: true, message: setting("OSRM_URL") ? "Nominatim und OSRM antworten." : "Nominatim antwortet – ohne OSRM wird die Fahrzeit geschätzt." };
      }
      default:
        return { ok: false, message: "Für diesen Anbieter gibt es keinen automatischen Test." };
    }
  } catch (err) {
    const msg = (err as Error).name === "TimeoutError" ? "Zeitüberschreitung – Anbieter nicht erreichbar." : (err as Error).message.slice(0, 200);
    return { ok: false, message: msg };
  }
}
