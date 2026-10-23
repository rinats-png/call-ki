import { env } from "../env";

/**
 * Registriert einen eingehenden Twilio-Anruf bei Retell (Custom Telephony)
 * und liefert die SIP-URI, auf die Twilio den Anruf weiterleitet.
 * https://docs.retellai.com/deploy/custom-telephony
 */
export async function registerRetellCall(input: {
  fromNumber: string;
  toNumber: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}): Promise<{ callId: string; sipUri: string }> {
  const e = env();
  if (!e.RETELL_API_KEY || !e.RETELL_AGENT_ID) throw new Error("Retell ist nicht konfiguriert");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000); // Twilio wartet max. 15 s – schnell scheitern & Fallback
  try {
    const res = await fetch("https://api.retellai.com/v2/register-phone-call", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.RETELL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: e.RETELL_AGENT_ID,
        from_number: input.fromNumber,
        to_number: input.toNumber,
        direction: "inbound",
        metadata: input.metadata,
        retell_llm_dynamic_variables: input.dynamicVariables,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { call_id?: string; message?: string };
    if (!res.ok || !json.call_id) throw new Error(`Retell register-phone-call: ${json.message ?? res.status}`);
    return { callId: json.call_id, sipUri: `sip:${json.call_id}@${e.RETELL_SIP_DOMAIN}` };
  } finally {
    clearTimeout(timer);
  }
}
