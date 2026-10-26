import { findCallRef } from "./payload";

/**
 * Normalisiert Gesprächs-Events.
 *  Retell: { event: "call_started" | "call_ended" | "call_analyzed", call: { call_id, from_number, to_number, transcript,
 *            recording_url, duration_ms, disconnection_reason, call_analysis: { call_summary } } }
 *  Vapi:   { message: { type: "end-of-call-report", call: { id, customer: { number }, phoneNumber: { number } }, artifact: { transcript, recordingUrl }, analysis: { summary }, durationSeconds } }
 */
export type CallEvent = {
  provider: "retell" | "vapi" | "elevenlabs";
  /** live = Zwischenstand während des Gesprächs (Live-Konsole) */
  kind: "started" | "ended" | "analyzed" | "live";
  callId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  transcript: string | null;
  summary: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  endReason: string | null;
  /** Zusätzliche Zuordnung (Twilio-CallSid, eigene Anruf-Referenz) */
  twilioCallSid?: string | null;
  callRef?: string | null;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function secondsBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = (Date.parse(b) - Date.parse(a)) / 1000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

/**
 * ElevenLabs Post-Call-Webhook „post_call_transcription“:
 * { type, event_timestamp, data: { conversation_id, transcript: [{ role, message }], analysis: { transcript_summary },
 *   metadata: { call_duration_secs, termination_reason, phone_call: { call_sid, agent_number, external_number } },
 *   conversation_initiation_client_data: { dynamic_variables: { call_ref, system__conversation_id } } } }
 */
export function parseElevenLabsEvent(body: unknown): CallEvent | null {
  const b = obj(body);
  if (b.type !== "post_call_transcription") return null;
  const d = obj(b.data);
  const meta = obj(d.metadata);
  const phone = obj(meta.phone_call);
  const vars = obj(obj(d.conversation_initiation_client_data).dynamic_variables);
  const lines = (Array.isArray(d.transcript) ? d.transcript : [])
    .map(obj)
    .filter((t) => str(t.message))
    .map((t) => `${t.role === "agent" ? "Agent" : "Anrufer"}: ${String(t.message).trim()}`);
  return {
    provider: "elevenlabs",
    kind: "analyzed",
    callId: str(d.conversation_id) ?? str(vars.system__conversation_id),
    fromNumber: str(phone.external_number) ?? str(vars.system__caller_id),
    toNumber: str(phone.agent_number) ?? str(vars.system__called_number),
    transcript: lines.length ? lines.join("\n") : null,
    summary: str(obj(d.analysis).transcript_summary),
    durationSec: num(meta.call_duration_secs),
    recordingUrl: null,
    endReason: str(meta.termination_reason),
    twilioCallSid: str(phone.call_sid) ?? str(vars.system__call_sid),
    callRef: str(vars.call_ref),
  };
}

export function parseCallEvent(body: unknown): CallEvent | null {
  const b = obj(body);
  const msg = obj(b.message);
  if (msg.type === "end-of-call-report") {
    const call = obj(msg.call);
    const art = obj(msg.artifact);
    return {
      provider: "vapi",
      kind: "analyzed",
      callId: str(call.id),
      fromNumber: str(obj(call.customer).number) ?? str(obj(msg.customer).number),
      toNumber: str(obj(call.phoneNumber).number),
      transcript: str(art.transcript) ?? str(msg.transcript),
      summary: str(obj(msg.analysis).summary) ?? str(msg.summary),
      durationSec: num(msg.durationSeconds) ?? secondsBetween(str(msg.startedAt) ?? str(call.startedAt), str(msg.endedAt) ?? str(call.endedAt)),
      recordingUrl: str(art.recordingUrl) ?? str(msg.recordingUrl),
      endReason: str(msg.endedReason),
      callRef: findCallRef(call),
    };
  }
  // Vapi während des Gesprächs: „conversation-update“ (ganzer Verlauf) bzw. „status-update“ (in-progress)
  if (msg.type === "conversation-update" || (msg.type === "status-update" && msg.status === "in-progress")) {
    const call = obj(msg.call);
    const list = Array.isArray(msg.conversation) ? msg.conversation : Array.isArray(msg.messages) ? msg.messages : [];
    const lines = list.map(obj).filter((m) => (m.role === "user" || m.role === "assistant" || m.role === "bot") && str(m.content ?? m.message))
      .map((m) => `${m.role === "user" ? "Anrufer" : "Agent"}: ${String(m.content ?? m.message).trim()}`);
    return { provider: "vapi", kind: msg.type === "status-update" ? "started" : "live", callId: str(call.id), fromNumber: str(obj(call.customer).number), toNumber: str(obj(call.phoneNumber).number), transcript: lines.length ? lines.join("\n") : null, summary: null, durationSec: null, recordingUrl: null, endReason: null, callRef: findCallRef(call) };
  }
  const kinds: Record<string, CallEvent["kind"]> = { call_started: "started", call_ended: "ended", call_analyzed: "analyzed", transcript_updated: "live" };
  const kind = typeof b.event === "string" ? kinds[b.event] : undefined;
  if (kind) {
    const call = obj(b.call);
    const dur = num(call.duration_ms);
    return {
      provider: "retell",
      kind,
      callId: str(call.call_id),
      fromNumber: str(call.from_number),
      toNumber: str(call.to_number),
      transcript: str(call.transcript),
      summary: str(obj(call.call_analysis).call_summary),
      durationSec: dur != null ? Math.round(dur / 1000) : null,
      recordingUrl: str(call.recording_url),
      endReason: str(call.disconnection_reason),
    };
  }
  return null;
}
