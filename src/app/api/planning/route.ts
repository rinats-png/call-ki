import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { requireModule } from "@/lib/addons";
import { resolveConfig } from "@/lib/tenant/settings";
import { planningData } from "@/lib/services/planning";

export const dynamic = "force-dynamic";

/** Teamkalender: ?view=day|week|month&date=YYYY-MM-DD */
export const GET = api(async (req) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "planning");
  const u = new URL(req.url);
  const q = z.object({ view: z.enum(["day", "week", "month"]).default("day"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse({ view: u.searchParams.get("view") ?? undefined, date: u.searchParams.get("date") });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId } });
  return NextResponse.json(await planningData(tenant, resolveConfig(tenant), q.view, q.date));
});
