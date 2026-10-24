#!/usr/bin/env bash
# Software-Stückliste (CycloneDX) und Lizenzprüfung der Produktionsabhängigkeiten.
#   bash scripts/sbom.sh [ausgabe.cdx.json]
# Bricht ab, wenn eine starke Copyleft-Lizenz (GPL/AGPL ohne „L“) oder eine unbekannte
# Lizenz auftaucht – dann prüfen, ob das Paket wirklich nötig ist.
set -euo pipefail
OUT=${1:-sbom.cdx.json}
npm sbom --sbom-format cyclonedx --omit dev > "$OUT"
node - "$OUT" <<'JS'
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const count = {}, bad = [];
for (const c of d.components ?? []) {
  const ls = (c.licenses ?? []).map((l) => l.expression ?? l.license?.id ?? l.license?.name).filter(Boolean);
  const key = ls.join(" AND ") || "UNBEKANNT";
  count[key] = (count[key] ?? 0) + 1;
  if (key === "UNBEKANNT" || /(^|[^L])(A)?GPL/.test(key.replace(/LGPL/g, ""))) bad.push(`${c.name}@${c.version}: ${key}`);
}
console.log(`${(d.components ?? []).length} Pakete (Produktion)`);
for (const [k, v] of Object.entries(count).sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
if (bad.length) { console.error("Lizenz prüfen:\n  " + bad.join("\n  ")); process.exit(1); }
JS
