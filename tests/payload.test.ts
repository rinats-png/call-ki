import { describe, expect, it } from "vitest";
import { formatToolResponse, normalizeToolRequest } from "@/lib/voice/payload";
import { parseCallEvent } from "@/lib/voice/events";

describe("Tool-Payloads", () => {
  it("parst Retell Custom Functions", () => {
    const r = normalizeToolRequest({ name: "find_technician", args: { postalCode: "20095" }, call: { call_id: "c1", from_number: "+4940123" } });
    expect(r.provider).toBe("retell");
    expect(r.callerNumber).toBe("+4940123");
    expect(r.calledNumber).toBeNull();
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

  it("verwechselt bei flachen Webhook-Tools (ElevenLabs/SIP) das Argument „name“ nicht mit dem Werkzeug", () => {
    const r = normalizeToolRequest({ name: "Erika Muster", postalCode: "10115", call_sid: "CA1" }, "save_customer");
    expect(r.calls[0].name).toBe("save_customer");
    expect(r.calls[0].args).toEqual({ name: "Erika Muster", postalCode: "10115" });
    expect(r.twilioCallSid).toBe("CA1");
  });
});

describe("Call-End-Events", () => {
  it("parst Retell call_analyzed", () => {
    const e = parseCallEvent({ event: "call_analyzed", call: { call_id: "c1", from_number: "+49", transcript: "Agent: Hallo", call_analysis: { call_summary: "Wespen" }, duration_ms: 61000 } });
    expect(e).toMatchObject({ provider: "retell", summary: "Wespen", durationSec: 61 });
  });
  it("erkennt Retell call_started / call_ended und ignoriert Unbekanntes", () => {
    expect(parseCallEvent({ event: "call_started", call: { call_id: "c1" } })?.kind).toBe("started");
    expect(parseCallEvent({ event: "call_ended", call: { call_id: "c1", to_number: "+4930", recording_url: "https://r" } })).toMatchObject({ kind: "ended", toNumber: "+4930", recordingUrl: "https://r" });
    expect(parseCallEvent({ event: "something_else" })).toBeNull();
  });
  it("parst Vapi end-of-call-report", () => {
    const e = parseCallEvent({ message: { type: "end-of-call-report", call: { customer: { number: "+49151" } }, artifact: { transcript: "AI: Hallo" }, analysis: { summary: "Ratten" } } });
    expect(e).toMatchObject({ provider: "vapi", fromNumber: "+49151", transcript: "AI: Hallo", summary: "Ratten" });
  });
});
