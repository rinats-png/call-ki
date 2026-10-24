import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Rechnungsanschrift und USt-IdNr. des eigenen Unternehmens (gilt für künftige Rechnungen) */
export const GET = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { name: true, billingAddress: true, billingVatId: true } });
  return NextResponse.json(t);
});

export const PUT = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const d = z.object({ billingAddress: z.string().trim().max(400), billingVatId: z.string().trim().max(30) }).parse(await readJson(req));
  await prisma.tenant.update({ where: { id: auth.tenantId }, data: { billingAddress: d.billingAddress || null, billingVatId: d.billingVatId || null } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "billing.address_update" });
  return NextResponse.json({ ok: true });
});
