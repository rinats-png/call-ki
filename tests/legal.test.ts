import { describe, expect, it } from "vitest";
import { buildPrivacyNotice } from "@/lib/voice/context";
import { avvMissing } from "@/lib/services/tenants";
import { parseSettings } from "@/lib/tenant/settings";

describe("Datenschutzhinweis für Anrufer", () => {
  it("nennt die URL sprechbar ohne Protokoll", () => {
    expect(buildPrivacyNotice("https://www.storm-gmbh.de/datenschutz/")).toContain("storm-gmbh.de/datenschutz.");
  });
  it("bietet ohne URL die Zusendung an", () => {
    expect(buildPrivacyNotice("")).toContain("sendet Ihnen das Büro");
  });
  it("übernimmt keine ungültige URL", () => {
    expect(parseSettings({ privacyUrl: "kein link" }).privacyUrl).toBe("");
  });
});

describe("AVV-Pflicht", () => {
  it("verlangt Version und Datum", () => {
    expect(avvMissing({ avvVersion: null, avvSignedAt: null })).toBe(true);
    expect(avvMissing({ avvVersion: "2026-10", avvSignedAt: null })).toBe(true);
    expect(avvMissing({ avvVersion: "2026-10", avvSignedAt: new Date() })).toBe(false);
  });
});
