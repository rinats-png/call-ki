import { describe, expect, it } from "vitest";
import { canDoTrade, cfgForService, matchService, normTerm } from "@/lib/services/catalog";
import { routeTechnician, type RoutingCandidate } from "@/lib/routing";
import type { TenantConfig } from "@/lib/tenant/settings";

const svc = (name: string, aliases = "") => ({ name, aliases });

describe("Leistungskatalog", () => {
  it("erkennt Leistungen über Name und weitere Begriffe, unabhängig von Schreibweise", () => {
    const list = [svc("Rohrbruch", "Wasserschaden, Leck"), svc("Heizungswartung", "Therme"), svc("Wespen")];
    expect(matchService(list, "rohrbruch")?.name).toBe("Rohrbruch");
    expect(matchService(list, "Wasserschaden")?.name).toBe("Rohrbruch");
    expect(matchService(list, "Wespennest")?.name).toBe("Wespen"); // eindeutiger Teiltreffer
    expect(matchService(list, "Ratten")).toBeNull();
    expect(matchService(list, null)).toBeNull();
    expect(normTerm("Schädlings-Bekämpfung!")).toBe("schaedlings bekaempfung");
  });

  it("nimmt bei mehrdeutigen Teiltreffern keine Leistung", () => {
    expect(matchService([svc("Rohr reinigen"), svc("Rohrbruch")], "Rohr")).toBeNull();
  });

  it("prüft Gewerke – leere Liste heißt alle", () => {
    expect(canDoTrade("", "Sanitär")).toBe(true);
    expect(canDoTrade("Sanitär, Heizung", "sanitär")).toBe(true);
    expect(canDoTrade("Heizung", "Sanitär")).toBe(false);
    expect(canDoTrade("Heizung", "")).toBe(true);
  });

  it("übernimmt die Dauer der Leistung, 0 = Standarddauer", () => {
    const cfg = { durationMin: 60 } as TenantConfig;
    expect(cfgForService(cfg, { durationMin: 90 }).durationMin).toBe(90);
    expect(cfgForService(cfg, { durationMin: 0 }).durationMin).toBe(60);
    expect(cfgForService(cfg, null)).toBe(cfg);
  });

  it("schickt keinen Heizungsbauer zum Rohrbruch, wenn ein Sanitärer verfügbar ist", () => {
    const e = (id: string, trades: string, codes = "*", openTickets = 0): RoutingCandidate => ({ id, name: id, role: "FIELD_TECH", email: null, servicePostalCodes: codes, directPhone: null, trades, openTickets });
    const team = [e("heizung", "Heizung", "55124"), e("sanitaer", "Sanitär", "*", 5)];
    const r = routeTechnician({ postalCode: "55124", urgency: "MEDIUM", trade: "Sanitär" }, team);
    expect(r.employee?.id).toBe("sanitaer");
    expect(r.reason).toContain("Gewerk: Sanitär");
    // Ohne Gewerk zählt wie bisher das genauere Gebiet
    expect(routeTechnician({ postalCode: "55124", urgency: "MEDIUM" }, team).employee?.id).toBe("heizung");
    // Niemand mit dem Gewerk → trotzdem jemand, mit Hinweis
    const only = routeTechnician({ postalCode: "55124", urgency: "MEDIUM", trade: "Elektro" }, team);
    expect(only.employee).not.toBeNull();
    expect(only.reason).toContain("niemand mit Gewerk „Elektro“");
  });
});
