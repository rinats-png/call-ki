import { describe, expect, it } from "vitest";
import { rangeFor } from "@/lib/services/planning";

describe("Teamkalender-Zeitraum", () => {
  it("Tag in Berliner Zeit", () => {
    const r = rangeFor("day", "2026-10-26", "Europe/Berlin");
    expect(r.days).toEqual(["2026-10-26"]);
    expect(r.from.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-26T23:00:00.000Z");
  });
  it("Woche ab Montag, auch über die Zeitumstellung", () => {
    const r = rangeFor("week", "2026-10-29", "Europe/Berlin");
    expect(r.days[0]).toBe("2026-10-26");
    expect(r.days).toHaveLength(7);
    const s = rangeFor("week", "2026-10-25", "Europe/Berlin"); // Sonntag der Umstellung
    expect(s.days[0]).toBe("2026-10-19");
    expect(s.from.toISOString()).toBe("2026-10-18T22:00:00.000Z");
  });
  it("Monat", () => {
    const r = rangeFor("month", "2026-02-14", "Europe/Berlin");
    expect(r.days).toHaveLength(28);
    expect(r.days[0]).toBe("2026-02-01");
  });
});
