import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Plattform-Admin öffnet das Portal eines Kunden (Support) bzw. verlässt es wieder. Wird protokolliert. */
export const POST = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const { tenantId } = z.object({ tenantId: z.string().nullable() }).parse(await readJson(req));
  if (tenantId && !(await prisma.tenant.count({ where: { id: tenantId } }))) throw notFound("Mandant");
  await prisma.session.update({ where: { id: auth.sessionId }, data: { activeTenantId: tenantId } });
  if (tenantId) await audit({ tenantId, userId: auth.user.id, action: "platform.enter_tenant" });
  return NextResponse.json({ ok: true });
});
