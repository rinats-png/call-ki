import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { BASE, Client, seed, type Seed } from "./helpers";

/**
 * HTTP-Tests gegen den laufenden Server (scripts/e2e.sh): Zugriffsregeln je Route,
 * CSRF, Re-Auth, 2FA-Pflicht, Webhook-Schutz und Sicherheits-Header.
 */
describe.skipIf(!BASE)("HTTP: Zugriffsregeln und Schutzmechanismen", () => {
  let s: Seed;
  beforeAll(async () => {
    s = await seed();
  });

  it("T-SEC-HTTP-01: ohne Anmeldung kein API-Zugriff, Seiten leiten zum Login", async () => {
    expect((await new Client().req("/api/dashboard")).status).toBe(401);
    const page = await new Client().req("/calls");
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");
  });

  it("T-SEC-HTTP-02: Vorgang eines fremden Mandanten → 404 (nicht 403)", async () => {
    const c = await new Client().login("admin@alpha.example");
    expect((await c.req(`/api/tickets/${s.A.ticket.id}`)).status).toBe(200);
    expect((await c.req(`/api/tickets/${s.B.ticket.id}`)).status).toBe(404);
    // Übersicht (Vorgangsliste) enthält nur eigene Vorgänge
    const dash = await (await c.req("/api/dashboard")).text();
    expect(dash).toContain(s.A.ticket.id);
    expect(dash).not.toContain(s.B.ticket.id);
  });

  it("T-SEC-HTTP-03: Mitarbeiter dürfen keine Einstellungen und Zugänge verwalten", async () => {
    const c = await new Client().login("mitarbeiter@alpha.example");
    expect((await c.req("/api/settings")).status).toBe(200);
    expect((await c.req("/api/settings", { method: "PUT", json: { settings: {} } })).status).toBe(403);
    expect((await c.req("/api/users")).status).toBe(403);
    expect((await c.req("/api/admin/tenants")).status).toBe(403);
  });

  it("T-SEC-HTTP-04: schreibende Anfragen von fremder Herkunft werden blockiert (CSRF)", async () => {
    const c = await new Client().login("admin@alpha.example");
    const r = await c.req("/api/settings", { method: "PUT", json: { settings: {} }, headers: { origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });

  it("T-SEC-HTTP-05: Plattform-Admin ohne 2FA kommt nicht an Admin-Daten", async () => {
    const c = await new Client().login("ohne2fa@example.org");
    const r = await c.req("/api/admin/tenants");
    expect(r.status).toBe(403);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("MFA_SETUP_REQUIRED");
  });

  it("T-SEC-HTTP-06: Plattform-Admin mit 2FA; sensible Aktion verlangt frische Bestätigung", async () => {
    const c = await new Client().login("plattform@example.org", s.adminTotp);
    expect((await c.req("/api/admin/tenants")).status).toBe(200);
    // Zugangslink für fremdes Konto = Re-Auth nötig, wenn die Anmeldung älter als 15 Minuten ist
    await prisma.session.updateMany({ where: { userId: s.platform.id }, data: { authAt: new Date(Date.now() - 20 * 60_000) } });
    const r = await c.req(`/api/admin/tenants/${s.A.tenant.id}/users`, { method: "POST", json: { userId: s.adminA.id } });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("REAUTH_REQUIRED");
  });

  it("T-SEC-HTTP-07: Webhooks und Cron ohne Geheimnis bzw. Signatur werden abgelehnt", async () => {
    const c = new Client();
    expect((await c.req("/api/voice/tools/identify_caller", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await c.req("/api/twilio/voice", { method: "POST", body: new URLSearchParams({ To: "+493011110000", From: "+4915000000000" }) })).status).toBe(403);
    expect((await c.req("/api/cron/monitor", { method: "POST" })).status).toBe(401);
  });

  it("T-SEC-HTTP-08: Sicherheits-Header sind gesetzt", async () => {
    const r = await new Client().req("/login");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBeTruthy();
  });

  it("T-SEC-HTTP-09: Anmeldung verrät nicht, ob ein Konto existiert", async () => {
    const c = new Client();
    const unknown = await c.req("/api/auth/login", { method: "POST", json: { email: "gibtsnicht@example.org", password: "falsch-falsch-falsch" } });
    const wrong = await c.req("/api/auth/login", { method: "POST", json: { email: "admin@alpha.example", password: "falsch-falsch-falsch" } });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.text()).toBe(await wrong.text());
  });
});
