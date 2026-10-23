import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Die Netlify-Testumgebung nutzt dieselben Migrationen wie der VPS (prisma migrate deploy). */
describe("Netlify-Migrationen", () => {
  it("enthalten jede Prisma-Migration unverändert", () => {
    const names = readdirSync("prisma/migrations").filter((n) => /^\d+_/.test(n));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(readFileSync(`netlify/database/migrations/${n}/migration.sql`, "utf8"), n).toBe(readFileSync(`prisma/migrations/${n}/migration.sql`, "utf8"));
    }
  });
});
