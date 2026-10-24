import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireRecentAuth, requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { createWebhook, WEBHOOK_EVENTS } from "@/lib/services/webhooks";
import { hasFeature, planForTenant } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** Webhooks des eigenen Unternehmens mit den letzten Zustellungen (Kunden-Admin) */
export const GET = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  const rows = await prisma.webhookEndpoint.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, events: true, active: true, createdAt: true, lastStatus: true, lastAt: true, deliveries: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, event: true, status: true, attempts: true, lastError: true, createdAt: true } } },
  });
  return NextResponse.json({ enabled: hasFeature((await planForTenant(auth.tenantId)).plan, "webhooks"), events: WEBHOOK_EVENTS, endpoints: rows });
});

/** Neuer Webhook – das Signatur-Geheimnis wird nur in dieser Antwort angezeigt */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  requireRecentAuth(auth);
  const d = z.object({ url: z.string().trim().max(500), events: z.array(z.string()).min(1).max(10) }).parse(await readJson(req));
  const r = await createWebhook(auth.tenantId, d.url, d.events);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "webhook.create", target: r.id, meta: { events: d.events } });
  return NextResponse.json(r, { status: 201 });
});
