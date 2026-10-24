import { describe, expect, it } from "vitest";
import { computeFreeSlots, formatGermanDateTime, fromZoned, toGraphLocal } from "@/lib/time";

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
    const slots = computeFreeSlots({ from, days: 5, busy, durationMin: 60, start: "08:00", end: "18:00", timeZone: TZ, max: 3, leadMinutes: 60 });
    expect(slots).toHaveLength(3);
    expect(toGraphLocal(slots[0].start, TZ)).toBe("2026-10-23T08:00:00");
    expect(toGraphLocal(slots[1].start, TZ)).toBe("2026-10-23T12:00:00");
    // Samstag/Sonntag übersprungen
    for (const s of slots) expect([0, 6]).not.toContain(new Date(toGraphLocal(s.start, TZ)).getDay());
    for (const s of slots) for (const b of busy) expect(s.start < b.end && s.end > b.start).toBe(false);
  });

  it("berücksichtigt Puffer und Arbeitstage", () => {
    const from = fromZoned(2026, 10, 23, 7, 0, TZ); // Freitag
    const busy = [{ start: fromZoned(2026, 10, 23, 9, 0, TZ), end: fromZoned(2026, 10, 23, 10, 0, TZ) }];
    const slots = computeFreeSlots({ from, days: 5, busy, durationMin: 60, start: "08:00", end: "12:00", timeZone: TZ, max: 2, leadMinutes: 60, bufferMin: 30, workDays: [5, 6] });
    // 08:00–09:00 kollidiert mit Puffer (08:30–10:30) → erster Slot 10:30; Samstag erlaubt
    expect(toGraphLocal(slots[0].start, TZ)).toBe("2026-10-23T10:30:00");
    expect(toGraphLocal(slots[1].start, TZ)).toBe("2026-10-24T08:00:00");
  });
});

describe("Zeitumstellung (Europe/Berlin)", () => {
  it("rechnet Wanduhrzeiten um das Ende der Sommerzeit am 25.10.2026 richtig", () => {
    expect(fromZoned(2026, 10, 24, 8, 0, TZ).toISOString()).toBe("2026-10-24T06:00:00.000Z"); // MESZ
    expect(fromZoned(2026, 10, 25, 8, 0, TZ).toISOString()).toBe("2026-10-25T07:00:00.000Z"); // MEZ
    expect(fromZoned(2026, 10, 26, 8, 0, TZ).toISOString()).toBe("2026-10-26T07:00:00.000Z");
    // 02:30 gibt es am 25.10. zweimal – Ergebnis muss eine der beiden Möglichkeiten sein
    expect(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]).toContain(fromZoned(2026, 10, 25, 2, 30, TZ).toISOString());
  });

  it("rechnet Wanduhrzeiten um den Beginn der Sommerzeit am 29.03.2026 richtig", () => {
    expect(fromZoned(2026, 3, 28, 8, 0, TZ).toISOString()).toBe("2026-03-28T07:00:00.000Z");
    expect(fromZoned(2026, 3, 29, 8, 0, TZ).toISOString()).toBe("2026-03-29T06:00:00.000Z");
    // 02:30 gibt es am 29.03. nicht – es darf nichts Ungültiges herauskommen
    const gap = fromZoned(2026, 3, 29, 2, 30, TZ);
    expect(Number.isNaN(gap.getTime())).toBe(false);
    expect(["01:30", "03:30"]).toContain(toGraphLocal(gap, TZ).slice(11, 16));
  });

  it("bietet über die Umstellung hinweg Termine zur richtigen Ortszeit an", () => {
    const from = fromZoned(2026, 10, 23, 17, 0, TZ); // Freitagabend, MESZ
    const slots = computeFreeSlots({ from, days: 5, busy: [], durationMin: 60, start: "08:00", end: "18:00", timeZone: TZ, max: 2, leadMinutes: 60, workDays: [1, 2, 3, 4, 5, 6, 7], spreadMin: 600 });
    expect(slots.map((s) => toGraphLocal(s.start, TZ))).toEqual(["2026-10-24T08:00:00", "2026-10-25T08:00:00"]);
    expect(slots[1].start.toISOString()).toBe("2026-10-25T07:00:00.000Z");
    expect(slots.every((s) => s.end.getTime() - s.start.getTime() === 3600_000)).toBe(true);

    const spring = computeFreeSlots({ from: fromZoned(2026, 3, 27, 17, 0, TZ), days: 5, busy: [], durationMin: 60, start: "08:00", end: "18:00", timeZone: TZ, max: 2, leadMinutes: 60 });
    expect(spring.map((s) => toGraphLocal(s.start, TZ))).toEqual(["2026-03-30T08:00:00", "2026-03-30T10:00:00"]);
  });

  it("beginnt Monate und Tage in Ortszeit (Abrechnung, Tagesgrenzen)", () => {
    expect(fromZoned(2026, 11, 1, 0, 0, TZ).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(fromZoned(2026, 4, 1, 0, 0, TZ).toISOString()).toBe("2026-03-31T22:00:00.000Z");
    expect(fromZoned(2027, 1, 1, 0, 0, TZ).toISOString()).toBe("2026-12-31T23:00:00.000Z");
    // Monatsüberlauf: 32. Oktober = 1. November
    expect(fromZoned(2026, 10, 32, 8, 0, TZ).toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(formatGermanDateTime(new Date("2026-10-25T07:00:00Z"), TZ)).toBe("Sonntag, 25. Oktober um 08:00 Uhr");
  });
});
