import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/http";
import { requireAuth, requireRecentAuth } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/crypto";
import { generateRecoveryCodes, normalizeRecoveryCode } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Neue Wiederherstellungscodes (alte werden ungültig). */
export const POST = api(async () => {
  const auth = await requireAuth();
  if (!auth.mfaEnabled) throw new HttpError(400, "Zwei-Faktor-Anmeldung ist nicht aktiv.");
  requireRecentAuth(auth);
  const codes = generateRecoveryCodes();
  await prisma.user.update({ where: { id: auth.user.id }, data: { recoveryCodes: codes.map((c) => sha256(normalizeRecoveryCode(c))) } });
  await audit({ tenantId: auth.user.tenantId, userId: auth.user.id, action: "auth.recovery_codes_regenerated" });
  return NextResponse.json({ recoveryCodes: codes });
});
