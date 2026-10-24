import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright";
import { BASE, PASSWORD, seed, totpNow, type Seed } from "./helpers";

/**
 * Browser-Tests der wichtigsten Abläufe (Chromium über Playwright, scripts/e2e.sh):
 * Anmeldung mit 2FA, Verwaltung, Kundenportal mit Mandantentrennung, Abmelden.
 */
describe.skipIf(!BASE)("E2E im Browser", () => {
  let s: Seed;
  let browser: Browser;
  beforeAll(async () => {
    s = await seed();
    const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
    browser = await pw.chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  }, 60_000);
  afterAll(async () => browser?.close());

  async function login(page: Page, email: string, totp?: string) {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click("button.btn-primary");
    if (totp) {
      await page.waitForSelector('input[name="code"]');
      await page.fill('input[name="code"]', totpNow(totp));
      await page.click("button.btn-primary");
    }
  }

  it("E2E-01: Plattform-Admin meldet sich mit 2FA an und sieht alle Kunden", async () => {
    const page = await browser.newPage();
    await login(page, "plattform@example.org", s.adminTotp);
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await page.getByText("Alpha GmbH").first().waitFor({ timeout: 15_000 });
    await page.getByText("Beta GmbH").first().waitFor({ timeout: 15_000 });
    await page.close();
  }, 60_000);

  it("E2E-02: Kunden-Admin sieht nur eigene Vorgänge", async () => {
    const page = await browser.newPage();
    await login(page, "admin@alpha.example");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    await page.getByText("Vorgang Alpha GmbH").first().waitFor({ timeout: 15_000 });
    expect(await page.content()).not.toContain("Vorgang Beta GmbH");
    // Direkter Aufruf eines fremden Vorgangs über die API im Browser-Kontext
    const status = await page.evaluate(async (id) => (await fetch(`/api/tickets/${id}`)).status, s.B.ticket.id);
    expect(status).toBe(404);
    await page.close();
  }, 60_000);

  it("E2E-04: Seiten laufen ohne CSP-Verstöße (Skripte nur mit Nonce)", async () => {
    const page = await browser.newPage();
    const violations: string[] = [];
    page.on("console", (m) => { if (/Content Security Policy|Refused to (execute|load)/i.test(m.text())) violations.push(m.text()); });
    await login(page, "admin@alpha.example");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    for (const path of ["/", "/calls", "/customers", "/settings", "/settings/plan", "/status"]) {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
    }
    // Theme-Skript lief (Nonce gültig): data-theme ist gesetzt
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toMatch(/light|dark/);
    expect(violations).toEqual([]);
    await page.close();
  }, 90_000);

  it("E2E-03: falsches Passwort zeigt einen Fehler, keine Anmeldung", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', "admin@alpha.example");
    await page.fill('input[name="password"]', "falsches-passwort-123");
    await page.click("button.btn-primary");
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe("/login");
    await page.close();
  }, 60_000);
});
