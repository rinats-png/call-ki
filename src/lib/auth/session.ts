import { cookies, headers } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "../db";
import { forbidden, unauthorized } from "../http";
import { randomToken, sha256 } from "./crypto";
import type { UserRole } from "../constants";

export const SESSION_COOKIE = "ck_session";
const SESSION_DAYS = 14;

export type AuthContext = {
  user: Pick<User, "id" | "email" | "name" | "role" | "tenantId">;
  sessionId: string;
  isPlatformAdmin: boolean;
  /** Effektiver Mandant: eigener Mandant bzw. bei Plattform-Admins der gewählte */
  tenantId: string | null;
};

export type TenantContext = AuthContext & { tenantId: string };

function cookieSecure() {
  return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await prisma.session.create({
    data: { id: sha256(token), userId, userAgent: ua, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Liefert den angemeldeten Nutzer oder null. Verlängert die Sitzung gleitend. */
export async function getAuth(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, role: true, tenantId: true, disabled: true, tenant: { select: { status: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.disabled) return null;

  // Gleitende Verlängerung höchstens einmal pro Stunde
  if (Date.now() - session.lastSeenAt.getTime() > 3600_000) {
    await prisma.session.update({
      where: { id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) },
    });
  }

  const isPlatformAdmin = session.user.role === "PLATFORM_ADMIN";
  const { disabled: _d, tenant: _t, ...user } = session.user;
  void _d; void _t;
  return {
    user,
    sessionId: id,
    isPlatformAdmin,
    tenantId: isPlatformAdmin ? session.activeTenantId : session.user.tenantId,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw unauthorized();
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

export function canManageTenant(auth: AuthContext): boolean {
  return auth.isPlatformAdmin || (auth.user.role as UserRole) === "TENANT_ADMIN";
}
