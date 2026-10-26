import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { chooseTrialPlan } from "@/lib/trial";

export const dynamic = "force-dynamic";

/** Paket für nach der Testphase wählen (Kunden-Admin). Nach Testende: sofort aktiv. */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const { planId } = z.object({ planId: z.string().min(1) }).parse(await readJson(req));
  const t = await chooseTrialPlan(auth.tenantId, planId);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "trial.choose_plan", target: planId });
  return NextResponse.json({ ok: true, active: t.planId === planId });
});
