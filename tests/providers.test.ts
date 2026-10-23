import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeToolRequest, formatToolResponse } from "@/lib/voice/payload";
import { parseCallEvent, parseElevenLabsEvent } from "@/lib/voice/events";
import { verifyElevenLabsSignature } from "@/lib/security";
import { numberFromSipUser } from "@/lib/voice/context";
import { providerFor, vapiSipUser } from "@/lib/voice/handoff";
import { SECRET_KEYS, SETTING_KEYS } from "@/lib/platform/registry";

describe("Sprach-KI-Anbieter", () => {
  it("wählt Anbieter: Nummer vor Kunde vor Standard", () => {
    expect(providerFor({ voiceProvider: null, voiceAgentId: null }, { voiceProvider: null, voiceAgentId: null }).provider).toBe("retell");
    expect(providerFor({ voiceProvider: null, voiceAgentId: null }, { voiceProvider: "vapi", voiceAgentId: "a1" })).toEqual({ provider: "vapi", agentId: "a1" });
    expect(providerFor({ voiceProvider: "elevenlabs", voiceAgentId: null }, { voiceProvider: "vapi", voiceAgentId: "a1" })).toEqual({ provider: "elevenlabs", agentId: null });
  });
  it("Vapi-SIP-Benutzer je Nummer und Rückweg", () => {
    expect(vapiSipUser("+4930123456")).toBe("ck4930123456");
    expect(numberFromSipUser("sip:ck4930123456@sip.vapi.ai")).toBe("+4930123456");
    expect(numberFromSipUser("+4930")).toBeNull();
  });
  it("ElevenLabs-Webhook-Tool: Metadaten getrennt von Argumenten", () => {
    const r = normalizeToolRequest({ call_sid: "CA1", called_number: "+4930", caller_id: "+49151", postalCode: "10115" }, "find_technician");
    expect(r).toMatchObject({ provider: "generic", twilioCallSid: "CA1", calledNumber: "+4930", callerNumber: "+49151" });
    expect(r.calls[0]).toMatchObject({ name: "find_technician", args: { postalCode: "10115" } });
    const env = normalizeToolRequest({ tool_name: "save_customer", tool_call_id: "t1", parameters: { name: "Max", call_ref: "clxabc1234567890" } });
    expect(env).toMatchObject({ callRef: "clxabc1234567890" });
    expect(env.calls[0]).toMatchObject({ id: "t1", name: "save_customer", args: { name: "Max" } });
  });
  it("Vapi-Toolantwort enthält Name und toolCallId", () => {
    const n = normalizeToolRequest({ message: { type: "tool-calls", call: { id: "v1", phoneNumber: { sipUri: "sip:ck4930@sip.vapi.ai" } }, toolCallList: [{ id: "tc1", function: { name: "find_technician", arguments: "{}" } }] } });
    expect(n.calledNumber).toBe("sip:ck4930@sip.vapi.ai");
    expect(formatToolResponse(n, [{ id: "tc1", name: "find_technician", result: { ok: 1 } }])).toEqual({ results: [{ name: "find_technician", toolCallId: "tc1", result: '{"ok":1}' }] });
  });
  it("Vapi-Gesprächsende: Dauer aus Start/Ende", () => {
    const e = parseCallEvent({ message: { type: "end-of-call-report", startedAt: "2026-10-23T10:00:00Z", endedAt: "2026-10-23T10:02:05Z", call: { id: "v1" }, artifact: {}, analysis: {} } });
    expect(e?.durationSec).toBe(125);
  });
  it("ElevenLabs post_call_transcription", () => {
    const e = parseElevenLabsEvent({ type: "post_call_transcription", data: { conversation_id: "conv1", transcript: [{ role: "agent", message: "Hallo" }, { role: "user", message: "Wespen" }], analysis: { transcript_summary: "Wespennest" }, metadata: { call_duration_secs: 42, phone_call: { call_sid: "CA9", external_number: "+49151", agent_number: "+4930" } }, conversation_initiation_client_data: { dynamic_variables: { call_ref: "row1" } } } });
    expect(e).toMatchObject({ provider: "elevenlabs", callId: "conv1", durationSec: 42, twilioCallSid: "CA9", callRef: "row1", summary: "Wespennest" });
    expect(e?.transcript).toBe("Agent: Hallo\nAnrufer: Wespen");
    expect(parseElevenLabsEvent({ type: "post_call_audio", data: {} })).toBeNull();
  });
  it("prüft die ElevenLabs-Signatur", () => {
    const body = '{"type":"post_call_transcription"}';
    const t = 1_800_000_000;
    const sig = crypto.createHmac("sha256", "geheim").update(`${t}.${body}`).digest("hex");
    expect(verifyElevenLabsSignature(body, `t=${t},v0=${sig}`, "geheim", t + 10)).toBe(true);
    expect(verifyElevenLabsSignature(body + " ", `t=${t},v0=${sig}`, "geheim", t + 10)).toBe(false);
    expect(verifyElevenLabsSignature(body, `t=${t},v0=${sig}`, "geheim", t + 3600)).toBe(false);
    expect(verifyElevenLabsSignature(body, null, "geheim")).toBe(false);
  });
  it("Registry: Geheimnisse sind als geheim markiert, Datenbank-Schlüssel nicht einstellbar", () => {
    for (const k of ["RETELL_API_KEY", "VAPI_API_KEY", "ELEVENLABS_API_KEY", "TWILIO_AUTH_TOKEN", "SMTP_PASS", "MS_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET", "VOICE_TOOL_SECRET"]) expect(SECRET_KEYS.has(k)).toBe(true);
    for (const k of ["DATABASE_URL", "APP_ENCRYPTION_KEY", "NODE_ENV", "SETUP_TOKEN"]) expect(SETTING_KEYS.has(k)).toBe(false);
  });
});
