import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/crypto";
import { generateRecoveryCodes, normalizeRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { open } from "@/lib/secret-box";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Bestätigt die Einrichtung mit einem ersten Code und gibt einmalig Wiederherstellungscodes aus. */
export const POST = api(async (req) => {
  const auth = await requireAuth({ allowMfaSetup: true });
  const { code } = z.object({ code: z.string().min(6).max(10) }).parse(await readJson(req));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  if (user.totpEnabledAt) throw new HttpError(409, "Bereits aktiv.");
  if (!user.totpSecretEnc) throw new HttpError(400, "Bitte zuerst die Einrichtung starten.");
  const step = verifyTotp(open(user.totpSecretEnc), code);
  if (step == null) throw new HttpError(400, "Der Code stimmt nicht. Bitte Uhrzeit des Smartphones prüfen und erneut versuchen.");

  const codes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodes: codes.map((c) => sha256(normalizeRecoveryCode(c))) } }),
    // Andere Sitzungen beenden, aktuelle gilt als frisch bestätigt
    prisma.session.deleteMany({ where: { userId: auth.user.id, id: { not: auth.sessionId } } }),
    prisma.session.update({ where: { id: auth.sessionId }, data: { authAt: new Date() } }),
  ]);
  await audit({ tenantId: auth.user.tenantId, userId: auth.user.id, action: "auth.mfa_enabled" });
  return NextResponse.json({ ok: true, recoveryCodes: codes });
});
