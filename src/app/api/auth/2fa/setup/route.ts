import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { api, HttpError } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { seal } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

/** Startet die Einrichtung: neues Secret (noch nicht aktiv) + QR-Code für die Authenticator-App. */
export const POST = api(async () => {
  const auth = await requireAuth({ allowMfaSetup: true });
  if (auth.mfaEnabled) throw new HttpError(409, "Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: auth.user.id }, data: { totpSecretEnc: seal(secret), totpEnabledAt: null, totpLastStep: null } });
  const uri = otpauthUri(secret, auth.user.email, env().PLATFORM_NAME);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return NextResponse.json({ secret, uri, qrSvg });
});
