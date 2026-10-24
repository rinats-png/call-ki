import type { PhoneNumber, Tenant } from "@prisma/client";
import { setting } from "../platform/config";
import { dialSip } from "../twiml";
import { maxCallSeconds } from "../cost-guard";
import { registerRetellCall } from "./retell";

/**
 * Übergabe eines Twilio-Anrufs an die gewählte Sprach-KI.
 *  - retell:      register-phone-call → <Dial><Sip>sip:{call_id}@sip.retellai.com
 *  - elevenlabs:  POST /v1/convai/twilio/register-call → fertiges TwiML (Media Stream)
 *  - vapi:        <Dial><Sip>sip:ck{nummer}@sip.vapi.ai (SIP-Nummer je Rufnummer, Firmendaten per assistant-request)
 *  - sip:{id}:    <Dial><Sip> an die hinterlegte SIP-Adresse mit Kopfzeilen X-Tenant/X-Caller/X-Called/X-Call-Ref
 * Reihenfolge der Auswahl: Rufnummer → Kunde → Plattform-Standard → Retell.
 */
export type VoiceProviderId = string; // "retell" | "vapi" | "elevenlabs" | `sip:${string}`

export function providerFor(number: Pick<PhoneNumber, "voiceProvider" | "voiceAgentId">, tenant: Pick<Tenant, "voiceProvider" | "voiceAgentId">): { provider: VoiceProviderId; agentId: string | null } {
  const tenantProvider = tenant.voiceProvider || setting("VOICE_PROVIDER") || "retell";
  const provider = number.voiceProvider || tenantProvider;
  // Agent-ID der Nummer vor der des Kunden – die des Kunden nur, wenn sie zum selben Anbieter gehört
  const agentId = number.voiceAgentId || (provider === tenantProvider ? tenant.voiceAgentId : null) || null;
  return { provider, agentId };
}

export type HandoffInput = {
  provider: VoiceProviderId;
  agentId: string | null;
  /** Ohne eigenen Agenten: Retell-Agent ohne Speicherung wählen, wenn nicht aufgezeichnet wird */
  recorded: boolean;
  fromNumber: string;
  toNumber: string;
  tenant: Pick<Tenant, "id" | "slug">;
  callRowId: string;
  twilioCallSid: string;
  dynamicVariables: Record<string, string>;
};

export type HandoffResult = { twiml: string; providerCallId: string | null; provider: string };

/** SIP-Benutzer der Plattform je Rufnummer bei Vapi: ck + Ziffern der E.164-Nummer */
export const vapiSipUser = (e164: string) => `ck${e164.replace(/\D/g, "")}`;
export const vapiSipHost = () => setting("VAPI_SIP_HOST") || "sip.vapi.ai";

async function elevenLabsRegister(input: HandoffInput): Promise<string> {
  const key = setting("ELEVENLABS_API_KEY");
  const agentId = input.agentId || setting("ELEVENLABS_AGENT_ID");
  if (!key || !agentId) throw new Error("ElevenLabs ist nicht konfiguriert");
  const res = await fetch(`${setting("ELEVENLABS_API_BASE") || "https://api.elevenlabs.io"}/v1/convai/twilio/register-call`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      from_number: input.fromNumber,
      to_number: input.toNumber,
      direction: "inbound",
      conversation_initiation_client_data: { dynamic_variables: { ...input.dynamicVariables, call_ref: input.callRowId } },
    }),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok || !text.includes("<Response")) throw new Error(`ElevenLabs register-call: ${res.status}`);
  return text;
}

export async function handoffCall(input: HandoffInput): Promise<HandoffResult> {
  const p = input.provider;
  if (p === "retell") {
    const agentId = input.agentId ?? (input.recorded ? null : setting("RETELL_AGENT_ID_NO_STORAGE") ?? null);
    const { callId, sipUri } = await registerRetellCall({
      agentId,
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      metadata: { tenant_id: input.tenant.id, call_row_id: input.callRowId, twilio_call_sid: input.twilioCallSid },
      dynamicVariables: input.dynamicVariables,
    });
    return { twiml: dialSip(sipUri, maxCallSeconds()), providerCallId: callId, provider: "retell" };
  }
  if (p === "elevenlabs") {
    const xml = await elevenLabsRegister(input);
    // ElevenLabs liefert ein vollständiges TwiML-Dokument; nur den Inhalt von <Response> übernehmen
    const inner = xml.replace(/^[\s\S]*?<Response[^>]*>/, "").replace(/<\/Response>[\s\S]*$/, "");
    return { twiml: inner, providerCallId: null, provider: "elevenlabs" };
  }
  if (p === "vapi") {
    if (!setting("VAPI_API_KEY")) throw new Error("Vapi ist nicht konfiguriert");
    const uri = `sip:${vapiSipUser(input.toNumber)}@${vapiSipHost()}?x-call_ref=${encodeURIComponent(input.callRowId)}`;
    return { twiml: dialSip(uri, maxCallSeconds()), providerCallId: null, provider: "vapi" };
  }
  if (p.startsWith("sip:")) {
    const id = p.slice(4);
    const base = setting(`SIP_${id.toUpperCase()}_URI`);
    if (!base) throw new Error(`SIP-Adresse für ${id} fehlt`);
    const headers = new URLSearchParams({ "X-Tenant": input.tenant.slug, "X-Caller": input.fromNumber, "X-Called": input.toNumber, "X-Call-Ref": input.callRowId });
    const uri = `${base}${base.includes("?") ? "&" : "?"}${headers.toString()}`;
    return { twiml: dialSip(uri, maxCallSeconds()), providerCallId: null, provider: id };
  }
  throw new Error(`Unbekannter Sprach-KI-Anbieter: ${p}`);
}
