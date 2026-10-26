import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integrationstests teilen sich eine Datenbank → Dateien nacheinander ausführen
    fileParallelism: !process.env.TEST_DATABASE_URL,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://localhost/unused", PWNED_CHECK: "false", REQUIRE_PLATFORM_ADMIN_2FA: "true" },
  },
});
