import { describe, expect, it } from "vitest";
import { assessUrgency } from "@/lib/urgency";
import { TEMPLATES } from "@/lib/tenant/templates";
import { resolveConfig } from "@/lib/tenant/settings";

const pest = TEMPLATES.pest_control.urgency;
const trades = TEMPLATES.trades.urgency;

describe("assessUrgency – Schädlingsbekämpfung", () => {
  it("erkennt Notfälle", () => {
    expect(assessUrgency({ category: "Wespen", description: "Mein Sohn ist allergisch und wurde gestochen", rules: pest })).toBe("CRITICAL");
    expect(assessUrgency({ category: "Wespen", description: "Nest in der Kita", rules: pest })).toBe("CRITICAL");
  });
  it("stuft Gewerbe bei Hygieneschädlingen hoch", () => {
    expect(assessUrgency({ category: "Schaben", customerType: "BUSINESS", rules: pest })).toBe("HIGH");
    expect(assessUrgency({ category: "Ratten", customerType: "PRIVATE", rules: pest })).toBe("MEDIUM");
  });
  it("ignoriert verneinte Stichwörter", () => {
    expect(assessUrgency({ category: "Ameisen", description: "nur eine Beratung, kein Notfall, keine Allergie", rules: pest })).toBe("LOW");
  });
  it("übernimmt die höhere KI-Einschätzung", () => {
    expect(assessUrgency({ category: "Ameisen", description: "Beratung", aiUrgency: "HIGH", rules: pest })).toBe("HIGH");
    expect(assessUrgency({ category: "Wespen", description: "allergisch", aiUrgency: "LOW", rules: pest })).toBe("CRITICAL");
  });
});

describe("assessUrgency – Handwerk", () => {
  it("erkennt Gasgeruch und Wasserschäden", () => {
    expect(assessUrgency({ category: "Sonstiges", description: "Im Keller riecht es nach Gas", rules: trades })).toBe("CRITICAL");
    expect(assessUrgency({ category: "Rohrbruch", rules: trades })).toBe("HIGH");
  });
});

describe("Mandanten-Konfiguration", () => {
  it("ergänzt eigene Stichwörter und Kategorien", () => {
    const cfg = resolveConfig({ industry: "general", settings: { urgencyKeywords: { critical: ["serverausfall"] }, categories: ["IT-Störung"] } });
    expect(cfg.categories).toEqual(["IT-Störung"]);
    expect(assessUrgency({ description: "Totaler Serverausfall", rules: cfg.urgencyRules })).toBe("CRITICAL");
  });
  it("fällt bei ungültigen Einstellungen auf Defaults zurück", () => {
    const cfg = resolveConfig({ industry: "unbekannt", settings: { appointments: { durationMin: "x" } } });
    expect(cfg.template.key).toBe("general");
    expect(cfg.durationMin).toBe(60);
  });
});

describe("Stichwort-Erkennung in gesprochener Sprache", () => {
  it("toleriert Füllwörter in Mehrwort-Stichwörtern", () => {
    expect(assessUrgency({ description: "Die Heizung ist seit gestern komplett aus", rules: trades })).toBe("HIGH");
    expect(assessUrgency({ description: "Hier riecht es stark nach Gas", rules: trades })).toBe("CRITICAL");
    expect(assessUrgency({ description: "Heizung läuft, Wartung bitte", rules: trades })).toBe("LOW");
  });
});

import { buildGreeting } from "@/lib/voice/context";
import { parseSettings } from "@/lib/tenant/settings";

describe("Begrüßung (KI-Transparenz, Art. 50 KI-VO)", () => {
  it("ergänzt den KI-Hinweis bei eigener Begrüßung ohne Offenlegung", () => {
    const g = buildGreeting("Meister KG", parseSettings({ greeting: "Meister KG, schönen guten Tag!", assistantName: "Max" }));
    expect(g).toMatch(/KI-Assistenz/);
    expect(g).toMatch(/aufgezeichnet/);
  });
  it("lässt eine Begrüßung mit Offenlegung unverändert (ohne Aufzeichnung)", () => {
    const g = buildGreeting("X", parseSettings({ greeting: "Hallo, hier ist die digitale Assistentin von X.", announceRecording: false }));
    expect(g).toBe("Hallo, hier ist die digitale Assistentin von X.");
  });
});

import { selectAgent } from "@/lib/voice/context";

describe("Keine stille Aufzeichnung", () => {
  const off = resolveConfig({ industry: "general", settings: { announceRecording: false } });
  const on = resolveConfig({ industry: "general", settings: {} });
  it("nutzt den Agenten ohne Speicherung, wenn vorhanden", () => {
    process.env.RETELL_AGENT_ID_NO_STORAGE = "agent_nostore";
    expect(selectAgent(null, off)).toEqual({ agentId: "agent_nostore", recorded: false });
    expect(selectAgent(null, on)).toEqual({ agentId: null, recorded: true });
  });
  it("kündigt die Aufzeichnung an, wenn kein Agent ohne Speicherung existiert", () => {
    delete process.env.RETELL_AGENT_ID_NO_STORAGE;
    const a = selectAgent(null, off);
    expect(a.recorded).toBe(true);
    expect(buildGreeting("X", off.settings, a.recorded)).toMatch(/aufgezeichnet/);
  });
  it("behandelt eigene Agenten je Nummer als aufzeichnend", () => {
    expect(selectAgent("agent_custom", off)).toEqual({ agentId: "agent_custom", recorded: true });
  });
});
