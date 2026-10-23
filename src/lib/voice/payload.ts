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
  callerNumber: string | null;
  /** Angerufene Nummer (zur Mandanten-Zuordnung, falls Call-ID unbekannt) */
  calledNumber: string | null;
  calls: ToolCall[];
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

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
      callerNumber: str(obj(call.customer).number) ?? str(obj(message.customer).number),
      calledNumber: str(obj(call.phoneNumber).number) ?? str(obj(message.phoneNumber).number),
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
      callerNumber: str(call.from_number),
      calledNumber: str(call.to_number),
      calls: [{ id: null, name: str(b.name) ?? toolNameFromPath ?? "", args: parseArgs(b.args) }],
    };
  }

  return {
    provider: "generic",
    callId: null,
    callerNumber: str(b.callerNumber) ?? str(b.from_number),
    calledNumber: str(b.calledNumber) ?? str(b.to_number),
    calls: [{ id: null, name: str(b.name) ?? toolNameFromPath ?? "", args: parseArgs(b.args ?? b.arguments ?? b) }],
  };
}

export function formatToolResponse(req: NormalizedToolRequest, results: Array<{ id: string | null; result: unknown }>) {
  if (req.provider === "vapi") {
    return {
      results: results.map((r) => ({
        toolCallId: r.id,
        result: typeof r.result === "string" ? r.result : JSON.stringify(r.result),
      })),
    };
  }
  // Retell akzeptiert beliebiges JSON (bzw. String) als Funktionsergebnis
  return results[0]?.result ?? {};
}
