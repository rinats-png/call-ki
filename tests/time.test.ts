import { describe, expect, it } from "vitest";
import { computeFreeSlots, fromZoned, toGraphLocal } from "@/lib/time";

const TZ = "Europe/Berlin";

describe("time", () => {
  it("rechnet Berliner Wanduhrzeit korrekt (Sommer- & Winterzeit)", () => {
    expect(fromZoned(2026, 7, 1, 9, 0, TZ).toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(fromZoned(2026, 12, 1, 9, 0, TZ).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(toGraphLocal(new Date("2026-07-01T07:00:00Z"), TZ)).toBe("2026-07-01T09:00:00");
  });

  it("findet freie Slots an Werktagen und umgeht belegte Zeiten", () => {
    // Freitag, 23.10.2026, 07:00 Berlin
    const from = fromZoned(2026, 10, 23, 7, 0, TZ);
    const busy = [{ start: fromZoned(2026, 10, 23, 9, 0, TZ), end: fromZoned(2026, 10, 23, 12, 0, TZ) }];
    const slots = computeFreeSlots({ from, days: 5, busy, durationMin: 60, startHour: 8, endHour: 18, timeZone: TZ, max: 3, leadMinutes: 60 });
    expect(slots).toHaveLength(3);
    expect(toGraphLocal(slots[0].start, TZ)).toBe("2026-10-23T08:00:00");
    expect(toGraphLocal(slots[1].start, TZ)).toBe("2026-10-23T12:00:00");
    // Samstag/Sonntag übersprungen
    for (const s of slots) expect([0, 6]).not.toContain(new Date(toGraphLocal(s.start, TZ)).getDay());
    for (const s of slots) for (const b of busy) expect(s.start < b.end && s.end > b.start).toBe(false);
  });
});
