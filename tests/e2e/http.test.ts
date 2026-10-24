import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/auth/crypto";
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

  it("T-SEC-HTTP-10: Ändern und Löschen fremder Datensätze → 404, Daten unverändert (T-SEC-02)", async () => {
    const c = await new Client().login("admin@alpha.example");
    expect((await c.req(`/api/tickets/${s.B.ticket.id}`, { method: "PATCH", json: { summary: "manipuliert" } })).status).toBe(404);
    expect((await c.req(`/api/customers/${s.B.customer.id}`, { method: "PATCH", json: { name: "manipuliert" } })).status).toBe(404);
    expect((await c.req(`/api/customers/${s.B.customer.id}`, { method: "DELETE", headers: { origin: BASE } })).status).toBe(404);
    expect((await prisma.callTicket.findUnique({ where: { id: s.B.ticket.id } }))?.summary).toBe("Vorgang Beta GmbH");
    expect((await prisma.customer.findUnique({ where: { id: s.B.customer.id } }))?.name).toBe("Kunde Beta GmbH");
  });

  it("T-SEC-HTTP-11: Rolle und Mandant lassen sich nicht über den Body setzen (T-SEC-03)", async () => {
    const c = await new Client().login("admin@alpha.example");
    const r = await c.req("/api/users", { method: "POST", json: { email: "neu@alpha.example", role: "PLATFORM_ADMIN", tenantId: s.B.tenant.id } });
    expect(r.status).toBe(400);
    const ok = await c.req("/api/users", { method: "POST", json: { email: "neu2@alpha.example", role: "TENANT_USER", tenantId: s.B.tenant.id } });
    expect(ok.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { email: "neu2@alpha.example" } }))?.tenantId).toBe(s.A.tenant.id);
  });

  it("T-SEC-HTTP-12: Reset-Link gilt einmal und nicht nach Ablauf; Reset beendet alle Sitzungen (T-SEC-06)", async () => {
    const other = await new Client().login("mitarbeiter@alpha.example");
    expect((await other.req("/api/dashboard")).status).toBe(200);
    const mk = async (expiresAt: Date) => {
      const token = randomToken();
      await prisma.authToken.create({ data: { id: sha256(token), userId: s.userA.id, type: "PASSWORD_RESET", expiresAt } });
      return token;
    };
    const token = await mk(new Date(Date.now() + 30 * 60_000));
    const body = { token, password: "Neues-Passwort-sehr-lang-2026", type: "PASSWORD_RESET" };
    expect((await new Client().req("/api/auth/reset", { method: "POST", json: body })).status).toBe(200);
    expect((await new Client().req("/api/auth/reset", { method: "POST", json: body })).status).toBe(410);
    expect((await other.req("/api/dashboard")).status).toBe(401);
    const expired = await mk(new Date(Date.now() - 60_000));
    expect((await new Client().req("/api/auth/reset", { method: "POST", json: { ...body, token: expired } })).status).toBe(410);
    // Passwort für die folgenden Tests zurücksetzen
    await prisma.user.update({ where: { id: s.userA.id }, data: { passwordHash: s.adminA.passwordHash } });
  });

  it("T-SEC-HTTP-13: „Passwort vergessen“ antwortet gleich, ob das Konto existiert oder nicht (T-SEC-09)", async () => {
    const c = new Client();
    const a = await c.req("/api/auth/forgot", { method: "POST", json: { email: "gibtsnicht@example.org" } });
    const b = await c.req("/api/auth/forgot", { method: "POST", json: { email: "admin@alpha.example" } });
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
  });

  it("T-SEC-HTTP-14: Reset-/Einladungslink für Kollegen nur mit frischer Bestätigung (T-SEC-29)", async () => {
    const c = await new Client().login("admin@alpha.example");
    await prisma.session.updateMany({ where: { userId: s.adminA.id }, data: { authAt: new Date(Date.now() - 20 * 60_000) } });
    const r = await c.req(`/api/users/${s.userA.id}`, { method: "PATCH", json: { action: "reset_password" } });
    expect(r.status).toBe(403);
    const j = (await r.json()) as { link?: string; details?: { code?: string } };
    expect(j.details?.code).toBe("REAUTH_REQUIRED");
    expect(j.link).toBeUndefined();
  });

  it("T-SEC-HTTP-15: Aufnahmen fremder Mandanten sind nicht abrufbar; Anbieter-URL bleibt verborgen", async () => {
    const callB = await prisma.call.create({ data: { tenantId: s.B.tenant.id, fromNumber: "+4915000000099", toNumber: "+493022220000", recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC/Recordings/RE-geheim" } });
    const c = await new Client().login("admin@alpha.example");
    expect((await c.req(`/api/calls/${callB.id}/recording`)).status).toBe(404);
    expect((await c.req(`/api/calls/${callB.id}`)).status).toBe(404);
  });

  it("T-SEC-HTTP-16: Abmelden beendet die Sitzung auf dem Server", async () => {
    const c = await new Client().login("admin@alpha.example");
    const old = c.cookie;
    expect((await c.req("/api/auth/logout", { method: "POST", json: {} })).status).toBe(200);
    const replay = new Client();
    replay.cookie = old;
    expect((await replay.req("/api/dashboard")).status).toBe(401);
  });

  it("T-SEC-HTTP-17: Minuten buchen und Paketwechsel nur für Kunden-Admins, Buchen mit frischer Bestätigung", async () => {
    const user = await new Client().login("mitarbeiter@alpha.example");
    expect((await user.req("/api/billing/topup", { method: "POST", json: { minutes: 100 } })).status).toBe(403);
    expect((await user.req("/api/billing/plan-request", { method: "POST", json: { planId: "x" } })).status).toBe(403);
    const admin = await new Client().login("admin@alpha.example");
    await prisma.session.updateMany({ where: { userId: s.adminA.id }, data: { authAt: new Date(Date.now() - 20 * 60_000) } });
    const r = await admin.req("/api/billing/topup", { method: "POST", json: { minutes: 100 } });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("REAUTH_REQUIRED");
    expect(await prisma.minuteTopUp.count()).toBe(0);
    expect((await admin.req("/api/admin/plan-requests")).status).toBe(403);
  });

  it("T-SEC-HTTP-18: Statusseite ist öffentlich und zeigt keine Kundendaten", async () => {
    const r = await new Client().req("/status");
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("Telefonannahme durch die KI");
    expect(html).not.toContain("Alpha GmbH");
  });
});
