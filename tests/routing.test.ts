import { describe, expect, it } from "vitest";
import { preferredRoleFor, routeTechnician, type RoutingCandidate } from "@/lib/routing";

const emp = (id: string, role: string, codes: string, extra: Partial<RoutingCandidate> = {}): RoutingCandidate => ({
  id, name: id, role, email: `${id}@example.com`, servicePostalCodes: codes, directPhone: "+49151000", openTickets: 0, ...extra,
});

const team = [
  emp("notdienst", "EMERGENCY_TECH", "*"),
  emp("nord", "FIELD_TECH", "20000-25999"),
  emp("sued", "FIELD_TECH", "80000-87999"),
  emp("b2b", "SPECIALIST", "20,80"),
  emp("office", "BACKOFFICE", "*", { directPhone: null }),
];

describe("preferredRoleFor", () => {
  it("wählt die fachlich passende Rolle", () => {
    expect(preferredRoleFor({ urgency: "CRITICAL", customerType: "BUSINESS" })).toBe("EMERGENCY_TECH");
    expect(preferredRoleFor({ urgency: "HIGH", customerType: "BUSINESS" })).toBe("SPECIALIST");
    expect(preferredRoleFor({ urgency: "MEDIUM", customerType: "PROPERTY_MANAGEMENT" })).toBe("SPECIALIST");
    expect(preferredRoleFor({ urgency: "HIGH", customerType: "PRIVATE" })).toBe("EMERGENCY_TECH");
    expect(preferredRoleFor({ urgency: "MEDIUM", customerType: "PRIVATE" })).toBe("FIELD_TECH");
    // Branchenvorlage kann festlegen, welche Kundentypen zum Spezialisten gehen
    expect(preferredRoleFor({ urgency: "MEDIUM", customerType: "BUSINESS", specialistCustomerTypes: ["PROPERTY_MANAGEMENT"] })).toBe("FIELD_TECH");
  });
});

describe("routeTechnician", () => {
  it("routet Privatkunden auf den Gebietstechniker", () => {
    const r = routeTechnician({ postalCode: "20095", urgency: "MEDIUM", customerType: "PRIVATE", roleLabels: { FIELD_TECH: "Monteur" } }, team);
    expect(r.employee?.id).toBe("nord");
    expect(r.areaMatch).toBe(true);
    expect(r.reason).toContain("Monteur");
  });
  it("routet HACCP-Kunden auf den B2B-Spezialisten im Gebiet", () => {
    const r = routeTechnician({ postalCode: "80331", urgency: "MEDIUM", customerType: "BUSINESS" }, team);
    expect(r.employee?.id).toBe("b2b");
  });
  it("routet Notfälle auf den Notdienst mit Durchstellung", () => {
    const r = routeTechnician({ postalCode: "20095", urgency: "CRITICAL", customerType: "PRIVATE" }, team);
    expect(r.employee?.id).toBe("notdienst");
    expect(r.transferRecommended).toBe(true);
  });
  it("fällt außerhalb aller Gebiete auf überregionale Rolle zurück", () => {
    const r = routeTechnician({ postalCode: "01067", urgency: "MEDIUM", customerType: "PRIVATE" }, team);
    // kein PEST_EXPERT im Gebiet → Notdienst (Wildcard, Außendienst) vor Backoffice
    expect(r.employee?.id).toBe("notdienst");
  });
  it("verteilt Last bei gleichwertigen Technikern", () => {
    const two = [emp("a", "FIELD_TECH", "20", { openTickets: 6 }), emp("b", "FIELD_TECH", "20", { openTickets: 1 })];
    expect(routeTechnician({ postalCode: "20095", urgency: "LOW" }, two).employee?.id).toBe("b");
  });
  it("liefert null ohne Mitarbeiter", () => {
    expect(routeTechnician({ postalCode: "20095", urgency: "LOW" }, []).employee).toBeNull();
  });
});
