import type { Employee } from "@prisma/client";
import { matchPostalCode, normalizePostalCode } from "./postal";
import { URGENCY_RANK, type EmployeeRole, type Urgency } from "./constants";

export type RoutingInput = {
  postalCode?: string | null;
  urgency: Urgency;
  customerType?: string | null;
  pestType?: string | null;
};

export type RoutingCandidate = Pick<Employee, "id" | "name" | "role" | "microsoftUpn" | "servicePostalCodes" | "directPhone"> & {
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
  if (input.customerType === "B2B_HACCP" || input.customerType === "PROPERTY_MANAGEMENT") return "B2B_SPECIALIST";
  if (URGENCY_RANK[input.urgency] >= URGENCY_RANK.HIGH) return "EMERGENCY_TECH";
  return "PEST_EXPERT";
}

const FIELD_ROLES: EmployeeRole[] = ["PEST_EXPERT", "EMERGENCY_TECH", "B2B_SPECIALIST"];

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
    return { e, area, isPreferred, score };
  });

  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  const best = scored[0];
  const ranked = scored.map((s) => ({ id: s.e.id, name: s.e.name, role: s.e.role, score: s.score }));

  if (!best) {
    return { employee: null, preferredRole, reason: "Keine Mitarbeiter hinterlegt.", areaMatch: false, transferRecommended: false, ranked };
  }

  let reason: string;
  if (best.area.matched && best.isPreferred) reason = `${best.e.name} ist ${preferredRole} und für PLZ ${plz} zuständig.`;
  else if (best.area.matched) reason = `Kein ${preferredRole} für PLZ ${plz} – ${best.e.name} (${best.e.role}) ist im Gebiet zuständig.`;
  else if (best.isPreferred) reason = `Kein Techniker für PLZ ${plz ?? "unbekannt"} – überregionaler ${preferredRole}: ${best.e.name}.`;
  else reason = `Kein passender Techniker gefunden – Weiterleitung an ${best.e.name} (${best.e.role}) für Rückruf.`;

  return {
    employee: best.e,
    preferredRole,
    reason,
    areaMatch: best.area.matched,
    transferRecommended: input.urgency === "CRITICAL" && !!best.e.directPhone,
    ranked,
  };
}
