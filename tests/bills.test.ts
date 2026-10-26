import { describe, expect, it } from "vitest";
import { calcBill, girocodePayload, validIban } from "@/lib/services/bills";

describe("calcBill", () => {
  it("rundet je Position und je Steuersatz", () => {
    const r = calcBill([
      { description: "Anfahrt", quantity: 1, unit: "pauschal", unitCents: 4500, taxRate: 19 },
      { description: "Arbeitszeit", quantity: 1.5, unit: "Stunde", unitCents: 6833, taxRate: 19 },
      { description: "Buch", quantity: 1, unit: "Stück", unitCents: 999, taxRate: 7 },
    ], false);
    expect(r.lines[1].totalCents).toBe(10250);
    expect(r.taxes).toEqual([{ rate: 19, netCents: 14750, taxCents: 2803 }, { rate: 7, netCents: 999, taxCents: 70 }]);
    expect(r.grossCents).toBe(14750 + 999 + 2803 + 70);
  });
  it("weist als Kleinunternehmer keine Steuer aus", () => {
    const r = calcBill([{ description: "x", quantity: 2, unit: "Stück", unitCents: 1000, taxRate: 19 }], true);
    expect(r.taxCents).toBe(0);
    expect(r.grossCents).toBe(2000);
  });
  it("lehnt fremde Steuersätze, Menge 0 und leere Beschreibung ab", () => {
    expect(() => calcBill([{ description: "x", quantity: 1, unit: "", unitCents: 1, taxRate: 16 }], false)).toThrow(/Steuersatz/);
    expect(() => calcBill([{ description: "x", quantity: 0, unit: "", unitCents: 1, taxRate: 19 }], false)).toThrow(/Menge/);
    expect(() => calcBill([{ description: " ", quantity: 1, unit: "", unitCents: 1, taxRate: 19 }], false)).toThrow(/Beschreibung/);
  });
});

describe("IBAN und GiroCode", () => {
  it("prüft die IBAN-Prüfziffer", () => {
    expect(validIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(validIban("DE88 3704 0044 0532 0130 00")).toBe(false);
    expect(validIban("kein")).toBe(false);
  });
  it("baut einen EPC-QR (BCD 002) und lässt ihn ohne gültige IBAN weg", () => {
    const p = girocodePayload({ name: "Becker Sanitär", iban: "DE89 3704 0044 0532 0130 00", amountCents: 12345, reference: "RE-2026-0001" })!;
    expect(p.split("\n")).toEqual(["BCD", "002", "1", "SCT", "", "Becker Sanitär", "DE89370400440532013000", "EUR123.45", "", "", "RE-2026-0001"]);
    expect(girocodePayload({ name: "x", iban: "DE00", amountCents: 100, reference: "r" })).toBeNull();
    expect(girocodePayload({ name: "x", iban: "DE89370400440532013000", amountCents: 0, reference: "r" })).toBeNull();
  });
});
