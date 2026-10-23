import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { planSchema } from "./schema";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePlatformAdmin();
  const plans = await prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }], include: { _count: { select: { tenants: true } } } });
  return NextResponse.json(plans.map(({ _count, ...p }) => ({ ...p, tenantCount: _count.tenants })));
});

export const POST = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const d = planSchema.parse(await readJson(req));
  if (await prisma.plan.findUnique({ where: { key: d.key } })) throw new HttpError(409, "Ein Paket mit diesem Kürzel gibt es schon.");
  const plan = await prisma.plan.create({ data: d });
  await audit({ userId: auth.user.id, action: "plan.create", target: plan.id, meta: { key: d.key } });
  return NextResponse.json(plan, { status: 201 });
});
