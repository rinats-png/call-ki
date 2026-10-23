/**
 * Erzeugt aus prisma/schema.prisma (SQLite, lokal) eine PostgreSQL-Variante
 * für Hosting/Produktion (z. B. Netlify Database). Das Datenmodell bleibt identisch.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("prisma/schema.prisma", "utf8");
const out = src
  .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
  .replace(/url\s*=\s*"file:\.\/dev\.db"/, 'url      = env("DATABASE_URL")')
  .replace(/provider\s*=\s*"prisma-client-js"/, 'provider      = "prisma-client-js"\n  binaryTargets = ["native", "rhel-openssl-3.0.x"]');

if (out === src) throw new Error("schema.prisma konnte nicht umgeschrieben werden");
mkdirSync("prisma/postgres", { recursive: true });
writeFileSync("prisma/postgres/schema.prisma", "// AUTOMATISCH ERZEUGT aus prisma/schema.prisma – nicht bearbeiten\n" + out);
console.log("✔ prisma/postgres/schema.prisma erzeugt");
