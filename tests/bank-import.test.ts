import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchCredit, parseBankCsv, parseCamt, parseGermanAmount, referenceHasNumber } from "@/lib/services/bank-import";

const fx = (f: string) => readFileSync(`${__dirname}/fixtures/${f}`);

describe("Kontoauszug lesen", () => {
  it("CAMT.053: nur Gutschriften, Sammelbuchung aufgeteilt, Entities dekodiert", () => {
    const c = parseCamt(fx("camt053.xml").toString("utf8"));
    expect(c.map((x) => x.amountCents)).toEqual([10591, 20000, 10000]);
    expect(c[0]).toMatchObject({ counterparty: "Jonas Weber", reference: "Rechnung RE-2026-0001 Danke & Gruss" });
    expect(c[0].date.toISOString().slice(0, 10)).toBe("2026-10-24");
    expect(c[1].counterparty).toBe("Hausverwaltung Kurz");
  });
  it("lehnt Nicht-CAMT-XML ab", () => {
    expect(() => parseCamt("<html></html>")).toThrow(/CAMT/);
  });
  it("Sparkassen-CSV (Windows-1252, Vorspann, Komma-Beträge)", () => {
    const text = new TextDecoder("windows-1252").decode(fx("sparkasse.csv"));
    const c = parseBankCsv(text);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ amountCents: 110591, counterparty: "Müller, Jürgen", reference: "RE-2026-0001" });
  });
  it("deutsche Beträge", () => {
    expect(parseGermanAmount("1.234,56 €")).toBe(123456);
    expect(parseGermanAmount("-12,5")).toBe(-1250);
    expect(parseGermanAmount("1234.56")).toBe(123456);
    expect(parseGermanAmount("")).toBeNull();
  });
});

describe("Zuordnung", () => {
  const open = [
    { id: "a", number: "RE-2026-0001", grossCents: 10591, customer: { name: "Jonas Weber", companyName: null } },
    { id: "b", number: "RE-2026-0002", grossCents: 20000, customer: { name: null, companyName: "Hausverwaltung Kurz" } },
    { id: "c", number: "RE-2026-0010", grossCents: 5000, customer: { name: "Erika Muster", companyName: null } },
  ];
  const credit = (amountCents: number, reference: string, counterparty = "") => ({ date: new Date(), amountCents, reference, counterparty });
  it("Nummer tolerant, aber nicht als Teil einer längeren Nummer", () => {
    expect(referenceHasNumber("re 2026 0001 danke", "RE-2026-0001")).toBe(true);
    expect(referenceHasNumber("RE20260001", "RE-2026-0001")).toBe(true);
    expect(referenceHasNumber("RE-2026-00010", "RE-2026-0001")).toBe(false);
  });
  it("Nummer + Betrag → automatisch", () => expect(matchCredit(credit(10591, "RE-2026-0001"), open)).toMatchObject({ status: "MATCHED", billId: "a" }));
  it("Nummer, aber Teilzahlung → Vorschlag", () => expect(matchCredit(credit(10000, "RE-2026-0002"), open)).toMatchObject({ status: "SUGGESTED", billId: "b" }));
  it("ohne Nummer: Betrag + Name → Vorschlag", () => expect(matchCredit(credit(5000, "Rechnung Wespen", "Muster, Erika"), open)).toMatchObject({ status: "SUGGESTED", billId: "c" }));
  it("nichts passt → keine Zuordnung", () => expect(matchCredit(credit(777, "Miete"), open).status).toBe("UNMATCHED"));
});
