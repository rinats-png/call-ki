/**
 * Normalisiert Tool-Call-Payloads von Retell AI und Vapi auf ein gemeinsames Format.
 *
 * Retell (Custom Function):  { name, args, call: { call_id, from_number, to_number, ... } }
 * Vapi   (Server URL):       { message: { type: "tool-calls", toolCallList: [{ id, function: { name, arguments } }], call: { customer: { number } } } }
 */
export type ToolCall = { id: string | null; name: string; args: Record<string, unknown> };
export type NormalizedToolRequest = {
  provider: "retell" | "vapi" | "generic";
  callId: string | null;
  /** Twilio-CallSid (ElevenLabs: system__call_sid) bzw. eigene Anruf-Referenz aus der SIP-Weiterleitung */
  twilioCallSid: string | null;
  callRef: string | null;
  callerNumber: string | null;
  /** Angerufene Nummer (zur Mandanten-Zuordnung, falls Call-ID unbekannt) */
  calledNumber: string | null;
  calls: ToolCall[];
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Sucht (begrenzt tief) nach einer Anruf-Referenz, z. B. SIP-Kopfzeile x-call_ref */
export function findCallRef(v: unknown, depth = 0): string | null {
  if (depth > 5 || !v || typeof v !== "object") return null;
  for (const [k, val] of Object.entries(v as Json)) {
    if (/^(x-)?call[_-]?ref$/i.test(k) && typeof val === "string" && /^[a-z0-9]{10,40}$/i.test(val)) return val;
    const inner = findCallRef(val, depth + 1);
    if (inner) return inner;
  }
  return null;
}

function parseArgs(v: unknown): Json {
  if (typeof v === "string") {
    try {
      return obj(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return obj(v);
}

export function normalizeToolRequest(body: unknown, toolNameFromPath?: string): NormalizedToolRequest {
  const b = obj(body);
  const message = obj(b.message);

  if (message.type === "tool-calls" || Array.isArray(message.toolCallList) || Array.isArray(message.toolWithToolCallList)) {
    const call = obj(message.call);
    const list = (Array.isArray(message.toolCallList) ? message.toolCallList : []).map(obj);
    return {
      provider: "vapi",
      callId: str(call.id),
      twilioCallSid: null,
      callRef: findCallRef(call) ?? findCallRef(message.customer),
      callerNumber: str(obj(call.customer).number) ?? str(obj(message.customer).number),
      calledNumber: str(obj(call.phoneNumber).number) ?? str(obj(message.phoneNumber).number) ?? str(obj(message.phoneNumber).sipUri) ?? str(obj(call.phoneNumber).sipUri),
      calls: list.map((tc) => {
        const fn = obj(tc.function);
        return { id: str(tc.id), name: str(fn.name) ?? str(tc.name) ?? "", args: parseArgs(fn.arguments ?? tc.arguments) };
      }),
    };
  }

  const call = obj(b.call);
  if ("args" in b || "call" in b) {
    return {
      provider: "retell",
      callId: str(call.call_id),
      twilioCallSid: null,
      callRef: null,
      callerNumber: str(call.from_number),
      calledNumber: str(call.to_number),
      calls: [{ id: null, name: str(b.name) ?? toolNameFromPath ?? "", args: parseArgs(b.args) }],
    };
  }

  // Generisch (ElevenLabs-Webhook-Tools, SIP-Anbieter): Felder direkt oder in „parameters“
  const p = obj(b.parameters);
  const pick = (...keys: string[]) => keys.map((k) => str(b[k]) ?? str(p[k])).find(Boolean) ?? null;
  const META = ["call_sid", "called_number", "caller_id", "call_ref", "x-call-ref", "callerNumber", "calledNumber", "from_number", "to_number", "conversation_id", "tool_call_id", "tool_name"];
  const flat = !Object.keys(p).length && b.args === undefined && b.arguments === undefined;
  const rawArgs = Object.keys(p).length ? p : parseArgs(b.args ?? b.arguments ?? b);
  // Bei flachem Body ist „name“ der Funktionsname, kein Argument
  const args = Object.fromEntries(Object.entries(rawArgs).filter(([k]) => !META.includes(k) && !(flat && k === "name" && toolNameFromPath === undefined)));
  return {
    provider: "generic",
    callId: null,
    twilioCallSid: pick("call_sid"),
    callRef: pick("call_ref", "x-call-ref"),
    callerNumber: pick("callerNumber", "from_number", "caller_id"),
    calledNumber: pick("calledNumber", "to_number", "called_number"),
    // Der Werkzeugname aus der URL hat Vorrang – sonst würde ein Argument „name“ (z. B. Kundenname) ihn überschreiben
    calls: [{ id: str(b.tool_call_id), name: toolNameFromPath ?? str(b.tool_name) ?? str(b.name) ?? "", args }],
  };
}

export function formatToolResponse(req: NormalizedToolRequest, results: Array<{ id: string | null; name?: string; result: unknown }>) {
  if (req.provider === "vapi") {
    return {
      results: results.map((r) => ({
        name: r.name,
        toolCallId: r.id,
        result: typeof r.result === "string" ? r.result : JSON.stringify(r.result),
      })),
    };
  }
  // Retell akzeptiert beliebiges JSON (bzw. String) als Funktionsergebnis
  return results[0]?.result ?? {};
}
