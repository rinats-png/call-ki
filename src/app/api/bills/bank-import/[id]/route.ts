import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { resolveSuggestion } from "@/lib/services/bank-import";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Vorschlag annehmen (Rechnung bezahlt) oder verwerfen */
export const POST = api<P>(async (req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["accept", "ignore"]) }).parse(await readJson(req));
  await resolveSuggestion(auth.tenantId, id, action);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `bills.bank_${action}`, target: id });
  return NextResponse.json({ ok: true });
});
