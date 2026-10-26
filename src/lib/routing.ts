import type { Employee } from "@prisma/client";
import { matchPostalCode, normalizePostalCode } from "./postal";
import { URGENCY_RANK, type EmployeeRole, type Urgency } from "./constants";
import { canDoTrade } from "./services/catalog";

export type RoutingInput = {
  postalCode?: string | null;
  urgency: Urgency;
  customerType?: string | null;
  category?: string | null;
  /** Gewerk der Leistung (aus dem Leistungskatalog); Mitarbeiter ohne dieses Gewerk werden nur notfalls gewählt */
  trade?: string | null;
  /** Kundentypen, die an SPECIALIST gehen (aus Branchenvorlage) */
  specialistCustomerTypes?: string[];
  /** Anzeigenamen der Rollen (aus Branchenvorlage) für die Begründung */
  roleLabels?: Partial<Record<string, string>>;
};

export type RoutingCandidate = Pick<Employee, "id" | "name" | "role" | "email" | "servicePostalCodes" | "directPhone"> & {
  trades?: string | null;
  openTickets?: number;
};

export type RoutingResult = {
  employee: RoutingCandidate | null;
  preferredRole: EmployeeRole;
  reason: string;
  areaMatch: boolean;
  /** Bei CRITICAL soll die KI live an den Techniker durchstellen. */
  transferRecommended: boolean;
  ranked: Array<{ id: string; name: string; role: string; score: number }>;
};

/** Welche Rolle passt fachlich zum Anliegen? */
export function preferredRoleFor(input: RoutingInput): EmployeeRole {
  if (URGENCY_RANK[input.urgency] >= URGENCY_RANK.CRITICAL) return "EMERGENCY_TECH";
  const specialistTypes = input.specialistCustomerTypes ?? ["BUSINESS", "PROPERTY_MANAGEMENT"];
  if (input.customerType && specialistTypes.includes(input.customerType)) return "SPECIALIST";
  if (URGENCY_RANK[input.urgency] >= URGENCY_RANK.HIGH) return "EMERGENCY_TECH";
  return "FIELD_TECH";
}

const FIELD_ROLES: EmployeeRole[] = ["FIELD_TECH", "EMERGENCY_TECH", "SPECIALIST"];

/**
 * Smart Routing:
 *  1. Fachlich passende Rolle im PLZ-Gebiet (genauester Gebietstreffer, geringste Auslastung)
 *  2. Andere Außendienst-Rolle im PLZ-Gebiet
 *  3. Passende Rolle außerhalb des Gebiets (überregional)
 *  4. Backoffice als Fallback (Rückruf)
 */
export function routeTechnician(input: RoutingInput, employees: RoutingCandidate[]): RoutingResult {
  const preferredRole = preferredRoleFor(input);
  const plz = normalizePostalCode(input.postalCode);

  const scored = employees.map((e) => {
    const area = plz ? matchPostalCode(plz, e.servicePostalCodes) : { matched: false, specificity: 0 };
    const isPreferred = e.role === preferredRole;
    const isField = FIELD_ROLES.includes(e.role as EmployeeRole);
    let score = 0;
    if (area.matched && isPreferred) score = 1000;
    else if (area.matched && isField) score = 600;
    else if (isPreferred) score = 300;
    else if (e.role === "BACKOFFICE") score = 100;
    else if (isField) score = 50;
    score += area.specificity * 10;
    score -= Math.min(e.openTickets ?? 0, 20) * 5; // Lastverteilung
    // Falsches Gewerk wiegt schwerer als ein Gebiet: Heizungsbauer nicht zum Rohrbruch
    const tradeOk = isField ? canDoTrade(e.trades, input.trade) : true;
    if (!tradeOk) score -= 900;
    return { e, area, isPreferred, score, tradeOk };
  });

  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  const best = scored[0];
  const ranked = scored.map((s) => ({ id: s.e.id, name: s.e.name, role: s.e.role, score: s.score }));

  if (!best) {
    return { employee: null, preferredRole, reason: "Keine Mitarbeiter hinterlegt.", areaMatch: false, transferRecommended: false, ranked };
  }

  const L = (r: string) => input.roleLabels?.[r] ?? r;
  let reason: string;
  const tradeNote = input.trade && !best.tradeOk ? ` Achtung: niemand mit Gewerk „${input.trade}“ verfügbar.` : input.trade ? ` Gewerk: ${input.trade}.` : "";
  if (best.area.matched && best.isPreferred) reason = `${best.e.name} (${L(preferredRole)}) ist für PLZ ${plz} zuständig.`;
  else if (best.area.matched) reason = `Kein ${L(preferredRole)} für PLZ ${plz} – ${best.e.name} (${L(best.e.role)}) ist im Gebiet zuständig.`;
  else if (best.isPreferred) reason = plz ? `Niemand für PLZ ${plz} hinterlegt – überregional: ${best.e.name} (${L(preferredRole)}).` : `Keine PLZ angegeben – ${best.e.name} (${L(preferredRole)}).`;
  else reason = `Keine passende Person gefunden – Weiterleitung an ${best.e.name} (${L(best.e.role)}) für Rückruf.`;

  reason += tradeNote;
  return {
    employee: best.e,
    preferredRole,
    reason,
    areaMatch: best.area.matched,
    transferRecommended: input.urgency === "CRITICAL" && !!best.e.directPhone,
    ranked,
  };
}
