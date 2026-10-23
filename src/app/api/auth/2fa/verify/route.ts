import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson, unauthorized } from "@/lib/http";
import { createSession, destroySession, getPendingMfaSession } from "@/lib/auth/session";
import { verifySecondFactor } from "@/lib/auth/mfa";
import { clientIp, enforce, LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Schritt 2 der Anmeldung: TOTP- oder Wiederherstellungscode. Danach neue, vollwertige Sitzung. */
export const POST = api(async (req) => {
  const pending = await getPendingMfaSession();
  if (!pending) throw unauthorized();
  const ip = await clientIp(req);
  enforce(`mfa:ip:${ip}`, LIMITS.mfaPerIp);
  try {
    enforce(`mfa:session:${pending.id}`, LIMITS.mfaPerSession);
  } catch (e) {
    await destroySession(); // zu viele Versuche → zurück zum Passwort
    throw e;
  }
  const { code } = z.object({ code: z.string().min(6).max(20) }).parse(await readJson(req));
  const kind = await verifySecondFactor(pending.userId, code);
  if (!kind) {
    await audit({ tenantId: pending.user.tenantId, userId: pending.userId, action: "auth.mfa_failed", meta: { ip } });
    throw new HttpError(401, "Der Code ist ungültig oder abgelaufen.");
  }
  await prisma.session.delete({ where: { id: pending.id } });
  await createSession(pending.userId);
  await prisma.user.update({ where: { id: pending.userId }, data: { lastLoginAt: new Date() } });
  await audit({ tenantId: pending.user.tenantId, userId: pending.userId, action: kind === "recovery" ? "auth.login_recovery_code" : "auth.login", meta: { ip, mfa: true } });
  const left = kind === "recovery" ? (await prisma.user.findUnique({ where: { id: pending.userId }, select: { recoveryCodes: true } }))?.recoveryCodes.length : undefined;
  return NextResponse.json({ ok: true, role: pending.user.role, recoveryCodesLeft: left });
});
