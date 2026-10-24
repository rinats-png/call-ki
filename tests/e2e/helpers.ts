import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/crypto";
import { seal } from "@/lib/secret-box";
import { currentStep, generateTotpSecret, totpAt } from "@/lib/auth/totp";

/**
 * Gemeinsame Hilfen für HTTP- und Browser-Tests gegen einen laufenden Server
 * (scripts/e2e.sh startet ihn mit derselben Datenbank und demselben APP_ENCRYPTION_KEY).
 */
export const BASE = process.env.E2E_BASE_URL ?? "";
export const PASSWORD = "Testpasswort-sehr-lang-2026!";

export type Seed = Awaited<ReturnType<typeof seed>>;

export async function seed() {
  await prisma.$executeRawUnsafe('TRUNCATE "Tenant", "User", "Message", "SystemState", "Plan", "RateLimitHit", "Session", "AuditLog" CASCADE');
  const hash = await hashPassword(PASSWORD);
  const mk = async (name: string, number: string) => {
    const tenant = await prisma.tenant.create({ data: { name, slug: name.toLowerCase().replace(/\W/g, "-"), industry: "pest_control", status: "ACTIVE", avvVersion: "TEST", avvSignedAt: new Date() } });
    await prisma.phoneNumber.create({ data: { tenantId: tenant.id, e164: number } });
    const customer = await prisma.customer.create({ data: { tenantId: tenant.id, phone: `${number}9`, name: `Kunde ${name}` } });
    const ticket = await prisma.callTicket.create({ data: { tenantId: tenant.id, customerId: customer.id, category: "Wespen", summary: `Vorgang ${name}` } });
    return { tenant, customer, ticket };
  };
  const A = await mk("Alpha GmbH", "+493011110000");
  const B = await mk("Beta GmbH", "+493022220000");
  const user = (email: string, role: string, tenantId: string | null, totp?: string) =>
    prisma.user.create({ data: { email, role, tenantId, passwordHash: hash, ...(totp ? { totpSecretEnc: seal(totp), totpEnabledAt: new Date() } : {}) } });
  const adminTotp = generateTotpSecret();
  return {
    A, B,
    adminA: await user("admin@alpha.example", "TENANT_ADMIN", A.tenant.id),
    userA: await user("mitarbeiter@alpha.example", "TENANT_USER", A.tenant.id),
    platform: await user("plattform@example.org", "PLATFORM_ADMIN", null, adminTotp),
    platformNo2fa: await user("ohne2fa@example.org", "PLATFORM_ADMIN", null),
    adminTotp,
  };
}

export const totpNow = (secret: string) => totpAt(secret, currentStep());

/** Minimaler Cookie-Client für die API. */
export class Client {
  cookie = "";
  constructor(private origin = BASE) {}
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      if (!headers.has("origin")) headers.set("origin", this.origin);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("ck_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    return res;
  }
  async login(email: string, totpSecret?: string) {
    const r = await this.req("/api/auth/login", { method: "POST", json: { email, password: PASSWORD } });
    if (r.status !== 200) throw new Error(`Login ${email}: ${r.status} ${await r.text()}`);
    const body = (await r.json()) as { mfaRequired?: boolean };
    if (body.mfaRequired) {
      if (!totpSecret) throw new Error("2FA-Code nötig");
      const v = await this.req("/api/auth/2fa/verify", { method: "POST", json: { code: totpNow(totpSecret) } });
      if (v.status !== 200) throw new Error(`2FA: ${v.status} ${await v.text()}`);
    }
    return this;
  }
}
