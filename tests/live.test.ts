import { describe, expect, it } from "vitest";
import { parseCallEvent } from "@/lib/voice/events";
import { describeTool } from "@/lib/services/live";

describe("Live-Ereignisse", () => {
  it("Retell transcript_updated → Zwischenstand", () => {
    const ev = parseCallEvent({ event: "transcript_updated", call: { call_id: "c1", transcript: "Agent: Hallo\nUser: Rohrbruch" } });
    expect(ev).toMatchObject({ provider: "retell", kind: "live", callId: "c1", transcript: "Agent: Hallo\nUser: Rohrbruch" });
  });
  it("Vapi conversation-update → Mitschrift aus dem Verlauf, System-Nachrichten weg", () => {
    const ev = parseCallEvent({ message: { type: "conversation-update", call: { id: "v1" }, conversation: [{ role: "system", content: "Prompt" }, { role: "assistant", content: "Guten Tag" }, { role: "user", content: "Wasser im Keller" }] } });
    expect(ev).toMatchObject({ provider: "vapi", kind: "live", callId: "v1", transcript: "Agent: Guten Tag\nAnrufer: Wasser im Keller" });
    expect(parseCallEvent({ message: { type: "status-update", status: "in-progress", call: { id: "v1" } } })?.kind).toBe("started");
    expect(parseCallEvent({ message: { type: "status-update", status: "ended", call: { id: "v1" } } })).toBeNull();
  });
});

describe("Erkannte Daten", () => {
  it("fasst Funktionsaufrufe für die Konsole zusammen", () => {
    const r = describeTool("book_appointment", { name: "Jonas Weber", postalCode: "55116", category: "Rohrbruch", appointmentStart: "2026-10-27T08:00:00Z" }, { ok: true, employee: "Emre", reference: "AB12CD34", urgency: "HIGH", say: "Termin ist eingetragen." });
    expect(r.data).toMatchObject({ name: "Jonas Weber", postalCode: "55116", category: "Rohrbruch", employee: "Emre", reference: "AB12CD34", urgency: "HIGH" });
    expect(r.text).toBe("Termin bzw. Anliegen gespeichert – Termin ist eingetragen.");
  });
});
