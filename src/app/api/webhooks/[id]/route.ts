import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Webhook pausieren bzw. wieder aktivieren */
export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const { active } = z.object({ active: z.boolean() }).parse(await readJson(req));
  const r = await prisma.webhookEndpoint.updateMany({ where: { id, tenantId: auth.tenantId }, data: { active } });
  if (!r.count) throw notFound("Webhook");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: active ? "webhook.resume" : "webhook.pause", target: id });
  return NextResponse.json({ ok: true });
});

export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const r = await prisma.webhookEndpoint.deleteMany({ where: { id, tenantId: auth.tenantId } });
  if (!r.count) throw notFound("Webhook");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "webhook.delete", target: id });
  return NextResponse.json({ ok: true });
});
