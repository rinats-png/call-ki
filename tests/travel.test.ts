import { describe, expect, it } from "vitest";
import { estimateLeg, haversineKm, type LatLon } from "@/lib/geo";
import { filterByTravel, pickSlots } from "@/lib/services/travel";
import { routeTechnician } from "@/lib/routing";

const mainz: LatLon = { lat: 50.0, lon: 8.27 };
const wiesbaden: LatLon = { lat: 50.08, lon: 8.24 };
const frankfurt: LatLon = { lat: 50.11, lon: 8.68 };
const d = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 3, h - 1, m)); // 3.11.2026, Berlin = UTC+1
const leg = async (a: LatLon, b: LatLon) => estimateLeg(a, b);

describe("Fahrzeit-Schätzung", () => {
  it("Luftlinie × 1,3 bei 45 km/h plus 5 Min.", () => {
    expect(Math.round(haversineKm(mainz, frankfurt))).toBe(32);
    const l = estimateLeg(mainz, frankfurt);
    expect(l.estimated).toBe(true);
    expect(l.minutes).toBeGreaterThan(55);
    expect(l.minutes).toBeLessThan(65);
    expect(estimateLeg(mainz, mainz).minutes).toBe(0);
  });
});

describe("Terminsuche mit Fahrzeit", () => {
  const slot = (h: number, m = 0) => ({ start: d(h, m), end: new Date(d(h, m).getTime() + 3600_000) });
  it("lässt Slots weg, wenn die Anfahrt vom vorherigen Termin nicht reicht", async () => {
    const stops = [{ start: d(9), end: d(10), loc: frankfurt }];
    const r = await filterByTravel({ candidates: [slot(10), slot(10, 30), slot(11, 30)], stops, origin: mainz, target: mainz, tz: "Europe/Berlin", workStart: "08:00", leg });
    expect(r.map((s) => s.start.toISOString())).toEqual([d(11, 30).toISOString()]);
  });
  it("berücksichtigt die Fahrt zum nächsten Termin und den Start am Betrieb", async () => {
    const stops = [{ start: d(12), end: d(13), loc: frankfurt }];
    const r = await filterByTravel({ candidates: [slot(8), slot(9), slot(10, 30)], stops, origin: frankfurt, target: mainz, tz: "Europe/Berlin", workStart: "08:00", leg });
    // 8:00 geht nicht (Anfahrt ab Frankfurt), 10:30–11:30 + ~1 h nach Frankfurt geht nicht bis 12:00
    expect(r.map((s) => s.start.getUTCHours() + 1)).toEqual([9]);
  });
  it("Bündeln: Slots neben einem Termin in der Nähe zuerst", async () => {
    const stops = [{ start: d(14), end: d(15), loc: wiesbaden }];
    const r = await filterByTravel({ candidates: [slot(9), slot(11), slot(15, 30)], stops, origin: mainz, target: mainz, tz: "Europe/Berlin", workStart: "08:00", leg });
    const picked = pickSlots(r, { max: 1, bundle: true, maxDetourMin: 25 });
    expect(picked[0].start.toISOString()).toBe(d(15, 30).toISOString());
    expect(pickSlots(r, { max: 1, bundle: false, maxDetourMin: 20 })[0].start.toISOString()).toBe(d(9).toISOString());
  });
});

describe("Zuständigkeit nach Fahrzeit", () => {
  const base = { email: null, directPhone: null, servicePostalCodes: "*", trades: "" };
  it("Gebiet nach Fahrzeit schlägt PLZ, kürzere Anfahrt gewinnt", () => {
    const r = routeTechnician({ postalCode: "55116", urgency: "MEDIUM" }, [
      { ...base, id: "a", name: "Anna", role: "FIELD_TECH", travelMin: 50, maxTravelMin: 30 },
      { ...base, id: "b", name: "Ben", role: "FIELD_TECH", travelMin: 12, maxTravelMin: 30 },
      { ...base, id: "c", name: "Cem", role: "FIELD_TECH", servicePostalCodes: "60", travelMin: 25 },
    ]);
    expect(r.employee?.id).toBe("b");
    expect(r.reason).toContain("Anfahrt ca. 12 Min.");
    expect(r.ranked.find((x) => x.id === "a")!.score).toBeLessThan(r.ranked.find((x) => x.id === "b")!.score);
  });
});
