/**
 * Normalisiert Gesprächsende-Events:
 *  Retell: { event: "call_ended" | "call_analyzed", call: { call_id, from_number, transcript, call_analysis: { call_summary }, duration_ms } }
 *  Vapi:   { message: { type: "end-of-call-report", call: { customer: { number } }, artifact: { transcript }, analysis: { summary }, durationSeconds } }
 */
export type CallEndEvent = {
  provider: "retell" | "vapi";
  callId: string | null;
  phone: string | null;
  transcript: string | null;
  summary: string | null;
  durationSec: number | null;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseCallEndEvent(body: unknown): CallEndEvent | null {
  const b = obj(body);
  const msg = obj(b.message);
  if (msg.type === "end-of-call-report") {
    const call = obj(msg.call);
    return {
      provider: "vapi",
      callId: str(call.id),
      phone: str(obj(call.customer).number) ?? str(obj(msg.customer).number),
      transcript: str(obj(msg.artifact).transcript) ?? str(msg.transcript),
      summary: str(obj(msg.analysis).summary) ?? str(msg.summary),
      durationSec: num(msg.durationSeconds),
    };
  }
  // Retell sendet "call_ended" und anschließend "call_analyzed" (mit Zusammenfassung) – wir verarbeiten call_analyzed
  if (b.event === "call_analyzed") {
    const call = obj(b.call);
    const dur = num(call.duration_ms);
    return {
      provider: "retell",
      callId: str(call.call_id),
      phone: str(call.from_number),
      transcript: str(call.transcript),
      summary: str(obj(call.call_analysis).call_summary),
      durationSec: dur != null ? Math.round(dur / 1000) : null,
    };
  }
  return null;
}
