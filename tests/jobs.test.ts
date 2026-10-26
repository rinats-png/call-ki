import { describe, expect, it } from "vitest";
import { invoiceLines, looksLikeImage, reportText, signatureFromDataUrl } from "@/lib/services/jobs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe("Einsatz → Rechnungspositionen", () => {
  it("nimmt Leistung mit Preis, Arbeitszeit und Material mit Preis", () => {
    const lines = invoiceLines({
      service: { id: "s1", name: "Rohrbruch", priceCents: 8900, unit: "pauschal", taxRate: 19 },
      hoursWorked: 1.5, hourlyRateCents: 6800,
      materials: [{ description: "Eckventil", quantity: 2, unit: "Stück", unitCents: 1250 }, { description: "Kleinmaterial", quantity: 1, unit: "pauschal", unitCents: 0 }],
    });
    expect(lines.map((l) => l.description)).toEqual(["Rohrbruch", "Arbeitszeit", "Eckventil"]);
    expect(lines[1]).toMatchObject({ quantity: 1.5, unitCents: 6800 });
  });
  it("ohne Preise keine Positionen", () => {
    expect(invoiceLines({ service: { id: "s", name: "x", priceCents: 0, unit: "", taxRate: 19 }, hoursWorked: 2, hourlyRateCents: 0, materials: [] })).toEqual([]);
  });
});

describe("Uploads", () => {
  it("prüft Magic Bytes", () => {
    expect(looksLikeImage("image/png", PNG)).toBe(true);
    expect(looksLikeImage("image/jpeg", PNG)).toBe(false);
    expect(looksLikeImage("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(looksLikeImage("image/svg+xml", Buffer.from("<svg/>"))).toBe(false);
  });
  it("akzeptiert nur PNG-Unterschriften", () => {
    expect(signatureFromDataUrl(`data:image/png;base64,${PNG.toString("base64")}`)?.length).toBe(PNG.length);
    expect(signatureFromDataUrl(null)).toBeNull();
    expect(() => signatureFromDataUrl("data:image/svg+xml;base64,PHN2Zy8+")).toThrow();
    expect(() => signatureFromDataUrl(`data:image/png;base64,${Buffer.from("kein png").toString("base64")}`)).toThrow();
  });
});

describe("Berichtstext", () => {
  it("fasst den Einsatz zusammen", () => {
    const t = reportText({ category: "Rohrbruch", summary: "Wasser unter der Spüle", findings: "Eckventil undicht", workDone: "Eckventil getauscht", materials: [{ description: "Eckventil", quantity: 1, unit: "Stück", unitCents: 0 }], hoursWorked: 1.5, arrivedAt: new Date("2026-10-26T08:00:00Z"), finishedAt: new Date("2026-10-26T09:30:00Z"), employeeName: "Emre" });
    expect(t).toContain("Einsatzbericht – Rohrbruch");
    expect(t).toContain("Befund: Eckventil undicht");
    expect(t).toContain("Arbeitszeit 1,5 h");
    expect(t).toContain("Material: 1 Stück Eckventil");
  });
});
