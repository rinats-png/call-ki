import { cookies, headers } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "../db";
import { HttpError, unauthorized, forbidden } from "../http";
import { randomToken, sha256 } from "./crypto";
import type { UserRole } from "../constants";
import { enforce, LIMITS } from "../rate-limit";

export const SESSION_COOKIE = "ck_session";

/**
 * Sitzungslaufzeiten je Rolle (security/standardwerte.md §4):
 *  - Plattform-Admin: 30 min Inaktivität, max. 12 h
 *  - Kundenkonten:    14 Tage Inaktivität (gleitend), max. 90 Tage
 *  - Ausstehender 2. Faktor: 10 min
 */
const POLICY = {
  admin: { idleMs: 30 * 60_000, absoluteMs: 12 * 3600_000 },
  tenant: { idleMs: 14 * 86400_000, absoluteMs: 90 * 86400_000 },
  mfaPendingMs: 10 * 60_000,
};
/** Sensible Aktionen verlangen eine Bestätigung, die höchstens so alt ist */
export const REAUTH_WINDOW_MS = 15 * 60_000;

const policyFor = (role: string) => (role === "PLATFORM_ADMIN" ? POLICY.admin : POLICY.tenant);

export type AuthContext = {
  user: Pick<User, "id" | "email" | "name" | "role" | "tenantId">;
  sessionId: string;
  isPlatformAdmin: boolean;
  /** Effektiver Mandant: eigener Mandant bzw. bei Plattform-Admins der gewählte */
  tenantId: string | null;
  mfaEnabled: boolean;
  /** 2FA ist für diese Rolle Pflicht, aber noch nicht eingerichtet */
  mfaSetupRequired: boolean;
  authAt: Date;
};

export type TenantContext = AuthContext & { tenantId: string };

function cookieSecure() {
  return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
}

/** Ist 2FA für diese Rolle verpflichtend? Plattform-Admin standardmäßig ja (abschaltbar nur für lokale Entwicklung). */
export function mfaRequiredFor(role: string): boolean {
  if (role === "PLATFORM_ADMIN") return process.env.REQUIRE_PLATFORM_ADMIN_2FA !== "false";
  if (role === "TENANT_ADMIN") return process.env.REQUIRE_TENANT_ADMIN_2FA === "true";
  return false;
}

/** Legt eine neue Sitzung an (immer neue ID – Schutz vor Session Fixation). */
export async function createSession(userId: string, opts: { mfaVerified?: boolean; activeTenantId?: string | null } = {}): Promise<void> {
  const token = randomToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  const verified = opts.mfaVerified ?? true;
  const lifetime = verified ? policyFor(user.role).idleMs : POLICY.mfaPendingMs;
  await prisma.session.create({
    data: { id: sha256(token), userId, userAgent: ua, mfaVerified: verified, activeTenantId: opts.activeTenantId ?? null, expiresAt: new Date(Date.now() + lifetime) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    // Sitzungscookie (ohne maxAge) für Admins; Kundenkonten bleiben angemeldet
    ...(user.role === "PLATFORM_ADMIN" || !verified ? {} : { maxAge: Math.floor(POLICY.tenant.idleMs / 1000) }),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

async function loadSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, role: true, tenantId: true, disabled: true, totpEnabledAt: true } } },
  });
  if (!session || session.user.disabled) return null;
  const now = Date.now();
  const p = policyFor(session.user.role);
  if (session.expiresAt.getTime() < now || now - session.createdAt.getTime() > p.absoluteMs) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  return session;
}

/** Sitzung, bei der noch der zweite Faktor aussteht (nur für /api/auth/2fa/verify). */
export async function getPendingMfaSession() {
  const s = await loadSession();
  return s && !s.mfaVerified ? s : null;
}

/** Liefert den angemeldeten Nutzer oder null. Verlängert die Sitzung gleitend. */
export async function getAuth(): Promise<AuthContext | null> {
  const session = await loadSession();
  if (!session || !session.mfaVerified) return null;

  const p = policyFor(session.user.role);
  // Gleitende Verlängerung höchstens alle 5 Minuten (Inaktivitäts-Timeout)
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + p.idleMs) } });
  }

  const isPlatformAdmin = session.user.role === "PLATFORM_ADMIN";
  const mfaEnabled = !!session.user.totpEnabledAt;
  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, tenantId: session.user.tenantId },
    sessionId: session.id,
    isPlatformAdmin,
    tenantId: isPlatformAdmin ? session.activeTenantId : session.user.tenantId,
    mfaEnabled,
    mfaSetupRequired: !mfaEnabled && mfaRequiredFor(session.user.role),
    authAt: session.authAt,
  };
}

/** `allowMfaSetup`: Endpunkte, die auch ohne eingerichtete Pflicht-2FA erreichbar sein müssen. */
export async function requireAuth(opts: { allowMfaSetup?: boolean } = {}): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw unauthorized();
  enforce(`api:user:${auth.user.id}`, LIMITS.apiPerUser);
  if (auth.mfaSetupRequired && !opts.allowMfaSetup) {
    throw new HttpError(403, "Bitte richten Sie zuerst die Zwei-Faktor-Anmeldung ein.", { code: "MFA_SETUP_REQUIRED" });
  }
  return auth;
}

/** Zugriff auf Mandantendaten. `adminOnly`: nur Kunden-Admins (und Plattform-Admins). */
export async function requireTenant(opts: { adminOnly?: boolean } = {}): Promise<TenantContext> {
  const auth = await requireAuth();
  if (!auth.tenantId) throw forbidden();
  if (opts.adminOnly && !auth.isPlatformAdmin && auth.user.role !== "TENANT_ADMIN") throw forbidden();
  return auth as TenantContext;
}

export async function requirePlatformAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.isPlatformAdmin) throw forbidden();
  return auth;
}

/** Sensible Aktion: Anmeldung/Bestätigung darf höchstens 15 Minuten zurückliegen. */
export function requireRecentAuth(auth: AuthContext): void {
  if (Date.now() - auth.authAt.getTime() > REAUTH_WINDOW_MS) {
    throw new HttpError(403, "Bitte bestätigen Sie diese Aktion mit Ihrem Passwort.", { code: "REAUTH_REQUIRED" });
  }
}

export function canManageTenant(auth: AuthContext): boolean {
  return auth.isPlatformAdmin || (auth.user.role as UserRole) === "TENANT_ADMIN";
}
