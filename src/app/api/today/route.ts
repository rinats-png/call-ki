import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, badRequest } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { requireModule } from "@/lib/addons";
import { resolveConfig } from "@/lib/tenant/settings";
import { myDay } from "@/lib/services/today";

export const dynamic = "force-dynamic";

/** Mein Tag: ?date=YYYY-MM-DD */
export const GET = api(async (req) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "planning");
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest("Datum fehlt");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId } });
  const [day, users] = await Promise.all([
    myDay(tenant, resolveConfig(tenant), { id: auth.user.id, email: auth.user.email }, date),
    prisma.user.findMany({ where: { tenantId: auth.tenantId, disabled: false }, select: { id: true, name: true, email: true }, orderBy: { email: "asc" } }),
  ]);
  return NextResponse.json({ ...day, users, me: auth.user.id });
});
