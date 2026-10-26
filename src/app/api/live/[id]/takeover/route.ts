import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { takeOver } from "@/lib/services/live";

export const dynamic = "force-dynamic";

/** Laufendes Gespräch übernehmen: Twilio verbindet den Anrufer mit der angegebenen Nummer */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const { number } = z.object({ number: z.string().trim().min(5).max(30) }).parse(await readJson(req));
  const r = await takeOver(auth.tenantId, id, number);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "call.takeover", target: id, meta: { to: `${r.number.slice(0, -3)}***` } });
  return NextResponse.json({ ok: true });
});
