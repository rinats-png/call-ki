import { describe, expect, it } from "vitest";
import { formatToolResponse, normalizeToolRequest } from "@/lib/voice/payload";
import { parseCallEndEvent } from "@/lib/voice/events";

describe("Tool-Payloads", () => {
  it("parst Retell Custom Functions", () => {
    const r = normalizeToolRequest({ name: "find_technician", args: { postalCode: "20095" }, call: { call_id: "c1", from_number: "+4940123" } });
    expect(r.provider).toBe("retell");
    expect(r.callerNumber).toBe("+4940123");
    expect(r.calls[0]).toEqual({ id: null, name: "find_technician", args: { postalCode: "20095" } });
  });

  it("parst Vapi tool-calls inkl. String-Argumenten", () => {
    const r = normalizeToolRequest({
      message: {
        type: "tool-calls",
        call: { id: "v1", customer: { number: "+4915112345678" } },
        toolCallList: [{ id: "tc1", function: { name: "identify_caller", arguments: "{\"phone\":\"0151\"}" } }],
      },
    });
    expect(r.provider).toBe("vapi");
    expect(r.calls[0].args).toEqual({ phone: "0151" });
    expect(formatToolResponse(r, [{ id: "tc1", result: { ok: true } }])).toEqual({ results: [{ toolCallId: "tc1", result: '{"ok":true}' }] });
  });

  it("nutzt den Pfad als Funktionsnamen", () => {
    const r = normalizeToolRequest({ args: { a: 1 }, call: {} }, "save_customer");
    expect(r.calls[0].name).toBe("save_customer");
  });
});

describe("Call-End-Events", () => {
  it("parst Retell call_analyzed", () => {
    const e = parseCallEndEvent({ event: "call_analyzed", call: { call_id: "c1", from_number: "+49", transcript: "Agent: Hallo", call_analysis: { call_summary: "Wespen" }, duration_ms: 61000 } });
    expect(e).toMatchObject({ provider: "retell", summary: "Wespen", durationSec: 61 });
  });
  it("ignoriert Retell call_started", () => {
    expect(parseCallEndEvent({ event: "call_started", call: {} })).toBeNull();
  });
  it("parst Vapi end-of-call-report", () => {
    const e = parseCallEndEvent({ message: { type: "end-of-call-report", call: { customer: { number: "+49151" } }, artifact: { transcript: "AI: Hallo" }, analysis: { summary: "Ratten" } } });
    expect(e).toMatchObject({ provider: "vapi", phone: "+49151", transcript: "AI: Hallo", summary: "Ratten" });
  });
});
