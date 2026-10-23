import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const schema = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()), password: z.string().min(1).max(200) });

export const POST = api(async (req) => {
  const { email, password } = schema.parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });

  // Gleiche Antwort für unbekannte Nutzer und falsches Passwort (keine Nutzer-Enumeration)
  const fail = new HttpError(401, "E-Mail oder Passwort ist falsch.");
  if (!user || user.disabled) {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); // Timing angleichen
    throw fail;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, `Zu viele Fehlversuche. Bitte in ${Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)} Minuten erneut versuchen.`);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null },
    });
    if (fails >= MAX_FAILS) await audit({ tenantId: user.tenantId, userId: user.id, action: "auth.locked" });
    throw fail;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ tenantId: user.tenantId, userId: user.id, action: "auth.login" });
  return NextResponse.json({ ok: true, role: user.role });
});
