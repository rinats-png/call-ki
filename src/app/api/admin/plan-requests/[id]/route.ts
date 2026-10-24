import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requirePlatformAdmin, requireRecentAuth } from "@/lib/auth/session";
import { decidePlanChange } from "@/lib/services/billing-requests";

export const dynamic = "force-dynamic";

/** Paketwechsel annehmen (Paket wird sofort umgestellt) oder ablehnen */
export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  requireRecentAuth(auth);
  const { id } = await params;
  const { action } = z.object({ action: z.enum(["approve", "reject"]) }).parse(await readJson(req));
  await decidePlanChange(id, auth.user.id, action === "approve");
  return NextResponse.json({ ok: true });
});
