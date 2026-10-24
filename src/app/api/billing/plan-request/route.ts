import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { requestPlanChange } from "@/lib/services/billing-requests";

export const dynamic = "force-dynamic";

/** Paketwechsel anfragen (Kunden-Admin) – der Betreiber nimmt an oder lehnt ab */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const d = z.object({ planId: z.string().min(1).max(40), note: z.string().trim().max(500).default("") }).parse(await readJson(req));
  const r = await requestPlanChange(auth.tenantId, auth.user.id, d.planId, d.note);
  return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
});
