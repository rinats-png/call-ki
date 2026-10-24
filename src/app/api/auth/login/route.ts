import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { clientIp, enforceShared, LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const schema = z.object({ email: z.string().email().max(200).transform((e) => e.toLowerCase().trim()), password: z.string().min(1).max(200) });
const DUMMY_HASH = "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";

/**
 * Schritt 1 der Anmeldung. Mit aktiver 2FA entsteht eine Sitzung „2. Faktor ausstehend“
 * (10 min), die erst über /api/auth/2fa/verify freigeschaltet wird.
 */
export const POST = api(async (req) => {
  const ip = await clientIp(req);
  await enforceShared(`login:ip:${ip}`, LIMITS.loginPerIp, "Zu viele Anmeldeversuche von dieser Adresse. Bitte später erneut versuchen.");
  const { email, password } = schema.parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });

  // Gleiche Antwort für unbekannte Nutzer und falsches Passwort (keine Nutzer-Enumeration)
  const fail = new HttpError(401, "E-Mail oder Passwort ist falsch.");
  if (!user || user.disabled) {
    await verifyPassword(password, DUMMY_HASH); // Antwortzeit angleichen
    throw fail;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const wait = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw new HttpError(429, `Zu viele Fehlversuche. Bitte in ${Math.ceil(wait / 60)} Minuten erneut versuchen.`, { retryAfter: wait });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    // Vorübergehende Sperre (keine dauerhafte – sonst ließen sich fremde Konten blockieren)
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null },
    });
    await audit({ tenantId: user.tenantId, userId: user.id, action: fails >= MAX_FAILS ? "auth.locked" : "auth.login_failed", meta: { ip } });
    throw fail;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  if (user.totpEnabledAt) {
    await createSession(user.id, { mfaVerified: false });
    return NextResponse.json({ ok: true, mfaRequired: true });
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ tenantId: user.tenantId, userId: user.id, action: "auth.login", meta: { ip } });
  return NextResponse.json({ ok: true, role: user.role });
});
