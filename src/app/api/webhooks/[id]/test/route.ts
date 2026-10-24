import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { enforceShared, LIMITS } from "@/lib/rate-limit";
import { deliverWebhook } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

/** Test-Ereignis an diesen Webhook senden und das Ergebnis direkt zurückgeben */
export const POST = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const ep = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!ep) throw notFound("Webhook");
  await enforceShared(`webhook:test:${ep.id}`, LIMITS.settingsTestPerUser);
  const d = await prisma.webhookDelivery.create({ data: { endpointId: ep.id, event: "test", payload: { message: "Testereignis der KI-Telefonzentrale" } } });
  const status = await deliverWebhook(d.id);
  const fresh = await prisma.webhookDelivery.findUnique({ where: { id: d.id }, select: { lastError: true } });
  return NextResponse.json({ ok: status === "SENT", error: fresh?.lastError ?? null });
});
