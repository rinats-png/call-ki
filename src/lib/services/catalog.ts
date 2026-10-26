import type { Service } from "@prisma/client";
import { prisma } from "../db";
import type { TenantConfig } from "../tenant/settings";

/** Begriffe vergleichbar machen: Groß/klein, Umlaute, Leer- und Satzzeichen egal. */
export function normTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function splitList(s: string | null | undefined): string[] {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

/** Passt eine Leistung zur Kategorie bzw. Beschreibung? Name und Aliase, ganze Wörter. */
export function matchService<S extends Pick<Service, "name" | "aliases">>(services: S[], category?: string | null): S | null {
  const c = category ? normTerm(category) : "";
  if (!c) return null;
  for (const s of services) {
    const terms = [s.name, ...splitList(s.aliases)].map(normTerm).filter(Boolean);
    if (terms.includes(c)) return s;
  }
  // Teiltreffer („Wespennest“ ↔ „Wespen“) nur, wenn eindeutig
  const partial = services.filter((s) => [s.name, ...splitList(s.aliases)].map(normTerm).some((t) => t.length >= 4 && (c.includes(t) || t.includes(c))));
  return partial.length === 1 ? partial[0] : null;
}

export async function activeServices(tenantId: string) {
  return prisma.service.findMany({ where: { tenantId, active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
}

export async function serviceForCategory(tenantId: string, category?: string | null): Promise<Service | null> {
  if (!category) return null;
  return matchService(await activeServices(tenantId), category);
}

/** Konfiguration mit der Dauer der Leistung (falls im Katalog hinterlegt). */
export function cfgForService(cfg: TenantConfig, service: Pick<Service, "durationMin"> | null): TenantConfig {
  return service && service.durationMin > 0 ? { ...cfg, durationMin: service.durationMin } : cfg;
}

/** Kann der Mitarbeiter dieses Gewerk? Leere Gewerke-Liste = alle. */
export function canDoTrade(employeeTrades: string | null | undefined, trade: string | null | undefined): boolean {
  if (!trade) return true;
  const list = splitList(employeeTrades).map(normTerm);
  return list.length === 0 || list.includes(normTerm(trade));
}
