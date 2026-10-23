/**
 * Prüft, ob eine PLZ in einer Liste kommagetrennter PLZ-Bereiche liegt.
 * Unterstützte Formate je Eintrag:
 *   "10115"        exakte PLZ
 *   "10", "101"    PLZ-Präfix (Leitzone / Leitbereich)
 *   "10000-14999"  numerischer Bereich (inklusive)
 *   "*"            Wildcard – gesamtes Einsatzgebiet
 */
export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/\d{5}/);
  return m ? m[0] : null;
}

export function parseServiceAreas(serviceCodes: string): string[] {
  return serviceCodes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type AreaMatch = { matched: boolean; specificity: number };

/** specificity: höher = genauerer Treffer (exakt 5 > Präfix-Länge > Bereich > Wildcard). */
export function matchPostalCode(postalCode: string, serviceCodes: string): AreaMatch {
  const plz = normalizePostalCode(postalCode);
  if (!plz) return { matched: false, specificity: 0 };
  let best = 0;
  for (const area of parseServiceAreas(serviceCodes)) {
    if (area === "*") {
      best = Math.max(best, 0.5);
      continue;
    }
    const range = area.match(/^(\d{1,5})\s*-\s*(\d{1,5})$/);
    if (range) {
      const from = Number(range[1].padEnd(5, "0"));
      const to = Number(range[2].padEnd(5, "9"));
      const n = Number(plz);
      if (n >= from && n <= to) best = Math.max(best, 1);
      continue;
    }
    if (/^\d{1,5}$/.test(area) && plz.startsWith(area)) {
      best = Math.max(best, 1 + area.length);
    }
  }
  return { matched: best > 0, specificity: best };
}
