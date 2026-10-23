import { describe, expect, it } from "vitest";
import { matchPostalCode, normalizePostalCode } from "@/lib/postal";

describe("postal", () => {
  it("normalisiert PLZ aus Freitext", () => {
    expect(normalizePostalCode("PLZ 20095 Hamburg")).toBe("20095");
    expect(normalizePostalCode("abc")).toBeNull();
  });
  it("matcht exakte PLZ, Präfixe, Bereiche und Wildcard", () => {
    expect(matchPostalCode("20095", "20095").matched).toBe(true);
    expect(matchPostalCode("20095", "20").matched).toBe(true);
    expect(matchPostalCode("20095", "21").matched).toBe(false);
    expect(matchPostalCode("23500", "20000-25999").matched).toBe(true);
    expect(matchPostalCode("26000", "20000-25999").matched).toBe(false);
    expect(matchPostalCode("99999", "*").matched).toBe(true);
  });
  it("bewertet genauere Treffer höher", () => {
    const exact = matchPostalCode("20095", "20095").specificity;
    const prefix = matchPostalCode("20095", "20").specificity;
    const range = matchPostalCode("20095", "20000-20999").specificity;
    const wildcard = matchPostalCode("20095", "*").specificity;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(range);
    expect(range).toBeGreaterThan(wildcard);
  });
});
