import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/crypto";
import { disconnectGoogle, GOOGLE_TYPE, googleAuthUrl, googleConfigured } from "@/lib/google";
import { hasFeature, planForTenant } from "@/lib/billing";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Startet die Google-Anmeldung: liefert die Zustimmungs-URL. */
export const POST = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  if (!googleConfigured()) throw new HttpError(503, "Google Kalender ist auf der Plattform noch nicht eingerichtet.");
  const { plan } = await planForTenant(auth.tenantId);
  if (!hasFeature(plan, "calendar_external")) throw new HttpError(403, "Outlook-/Google-Kalender ist in Ihrem Paket nicht enthalten.");
  const nonce = randomToken(18);
  const existing = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: GOOGLE_TYPE } } });
  const config = { ...((existing?.config ?? {}) as object), pendingState: nonce } as Prisma.InputJsonValue;
  await prisma.integration.upsert({
    where: { tenantId_type: { tenantId: auth.tenantId, type: GOOGLE_TYPE } },
    create: { tenantId: auth.tenantId, type: GOOGLE_TYPE, status: "PENDING", config },
    update: { config, ...(existing?.status === "CONNECTED" ? {} : { status: "PENDING" }) },
  });
  return NextResponse.json({ url: googleAuthUrl(`${auth.tenantId}.${nonce}`) });
});

export const DELETE = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  await disconnectGoogle(auth.tenantId);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "integration.google.disconnect" });
  return NextResponse.json({ ok: true });
});
