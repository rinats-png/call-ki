import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/http";
import { mfaRequiredFor, requireAuth, requireRecentAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const POST = api(async () => {
  const auth = await requireAuth();
  if (mfaRequiredFor(auth.user.role)) throw new HttpError(403, "Für Ihre Rolle ist die Zwei-Faktor-Anmeldung Pflicht.");
  requireRecentAuth(auth);
  await prisma.user.update({ where: { id: auth.user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] } });
  await audit({ tenantId: auth.user.tenantId, userId: auth.user.id, action: "auth.mfa_disabled" });
  return NextResponse.json({ ok: true });
});
