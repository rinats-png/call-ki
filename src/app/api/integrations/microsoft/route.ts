import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { microsoftConfigured } from "@/lib/env";
import { adminConsentUrl, testMailbox } from "@/lib/graph";
import { randomToken } from "@/lib/auth/crypto";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const getCfg = (c: unknown) => (c ?? {}) as { msTenantId?: string; draftMailbox?: string; pendingState?: string };

/** Startet die Verbindung: liefert die Microsoft-Admin-Consent-URL. */
export const POST = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  if (!microsoftConfigured()) throw new HttpError(503, "Microsoft-Integration ist auf der Plattform noch nicht eingerichtet (MS_CLIENT_ID/MS_CLIENT_SECRET).");
  const nonce = randomToken(18);
  const existing = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: "MICROSOFT_365" } } });
  const config = { ...getCfg(existing?.config), pendingState: nonce } as Prisma.InputJsonValue;
  await prisma.integration.upsert({
    where: { tenantId_type: { tenantId: auth.tenantId, type: "MICROSOFT_365" } },
    create: { tenantId: auth.tenantId, type: "MICROSOFT_365", status: "PENDING", config },
    update: { config, ...(existing?.status === "CONNECTED" ? {} : { status: "PENDING" }) },
  });
  return NextResponse.json({ url: adminConsentUrl(`${auth.tenantId}.${nonce}`) });
});

const putSchema = z.object({ draftMailbox: z.string().email().or(z.literal("")) });

/** Entwurfs-Postfach setzen und Zugriff testen. */
export const PUT = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const { draftMailbox } = putSchema.parse(await readJson(req));
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: "MICROSOFT_365" } } });
  const cfg = getCfg(integ?.config);
  if (!integ || integ.status !== "CONNECTED" || !cfg.msTenantId) throw new HttpError(400, "Microsoft 365 ist nicht verbunden.");
  if (draftMailbox) {
    try {
      await testMailbox(cfg.msTenantId, draftMailbox);
    } catch (err) {
      throw new HttpError(400, `Postfach nicht erreichbar: ${(err as Error).message}`);
    }
  }
  await prisma.integration.update({ where: { id: integ.id }, data: { config: { ...cfg, draftMailbox }, lastError: null } });
  return NextResponse.json({ ok: true });
});

export const DELETE = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  await prisma.integration.updateMany({ where: { tenantId: auth.tenantId, type: "MICROSOFT_365" }, data: { status: "DISCONNECTED", config: {} } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "integration.microsoft.disconnect" });
  return NextResponse.json({ ok: true });
});
