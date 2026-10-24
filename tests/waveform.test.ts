import { describe, expect, it } from "vitest";
import { computePeaks, fmtClock, placeholderPeaks } from "@/lib/waveform";

describe("Wellenform", () => {
  it("liefert so viele Balken wie verlangt, normiert auf 0–1", () => {
    const ch = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) ch[i] = i < 500 ? 0.1 : -0.8;
    const p = computePeaks([ch], 10);
    expect(p).toHaveLength(10);
    expect(Math.max(...p)).toBe(1);
    expect(p[0]).toBeCloseTo(Math.sqrt(0.1 / 0.8), 5);
  });

  it("nutzt den lautesten Kanal", () => {
    const l = new Float32Array([0.1, 0.1, 0.1, 0.1]);
    const r = new Float32Array([0.5, 0.5, 0.2, 0.2]);
    const p = computePeaks([l, r], 2);
    expect(p[0]).toBe(1);
    expect(p[1]).toBeCloseTo(Math.sqrt(0.2 / 0.5), 5);
  });

  it("kommt mit Stille und leeren Daten zurecht", () => {
    expect(computePeaks([new Float32Array(100)], 5)).toEqual([0, 0, 0, 0, 0]);
    expect(computePeaks([], 3)).toEqual([0, 0, 0]);
  });

  it("Platzhalter ist je ID gleich und im gültigen Bereich", () => {
    const a = placeholderPeaks("call_1", 48);
    expect(a).toEqual(placeholderPeaks("call_1", 48));
    expect(a).not.toEqual(placeholderPeaks("call_2", 48));
    expect(a.every((v) => v >= 0.12 && v <= 1)).toBe(true);
  });

  it("formatiert Zeiten", () => {
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(83.7)).toBe("1:23");
    expect(fmtClock(NaN)).toBe("0:00");
  });
});
