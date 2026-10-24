import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Jede Variable, die der Code liest, steht in .env.example (OP-22-01). */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe(".env.example", () => {
  it("enthält alle Variablen aus Code und Einstellungen", () => {
    const used = new Set<string>();
    for (const f of files("src")) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/setting(?:Number)?\("([A-Z0-9_]+)"/g)) used.add(m[1]);
      for (const m of s.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
    }
    for (const m of readFileSync("src/lib/env.ts", "utf8").matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)) used.add(m[1]);
    // Felder der Plattform-Einstellungen (Oberfläche) – SIP-Anbieter sind dynamisch (SIP_<ID>_URI)
    for (const m of readFileSync("src/lib/platform/registry.ts", "utf8").matchAll(/\bkey: "([A-Z][A-Z0-9_]+)"/g)) used.add(m[1]);
    const example = new Set([...readFileSync(".env.example", "utf8").matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
    const ignore = new Set(["NODE_ENV", "NETLIFY_DB_URL", "BACKUP_EXPECTED", "TEST_DATABASE_URL"]);
    expect([...used].filter((k) => !example.has(k) && !ignore.has(k)).sort()).toEqual([]);
  });
});
