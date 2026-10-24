import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/crypto";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { enforceShared, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Bestätigt die Identität erneut (Passwort, bei aktiver 2FA zusätzlich Code) für sensible Aktionen. */
export const POST = api(async (req) => {
  const auth = await requireAuth({ allowMfaSetup: true });
  await enforceShared(`reauth:${auth.user.id}`, LIMITS.reauthPerUser);
  const { password, code } = z.object({ password: z.string().min(1).max(200), code: z.string().max(20).optional() }).parse(await readJson(req));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, "Das Passwort ist falsch.");
  if (auth.mfaEnabled) {
    if (!code) throw new HttpError(401, "Bitte zusätzlich den Code aus der Authenticator-App eingeben.", { code: "MFA_CODE_REQUIRED" });
    if (!(await verifySecondFactor(auth.user.id, code))) throw new HttpError(401, "Der Code ist ungültig.", { code: "MFA_CODE_REQUIRED" });
  }
  await prisma.session.update({ where: { id: auth.sessionId }, data: { authAt: new Date() } });
  return NextResponse.json({ ok: true });
});
