import { NextResponse } from "next/server";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { customerFile } from "@/lib/services/customer-file";

export const dynamic = "force-dynamic";

/** Kundenakte: Stammdaten, Kennzahlen und Verlauf über alle Kanäle */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const f = await customerFile(auth.tenantId, id);
  if (!f) throw notFound("Kunde");
  return NextResponse.json(f);
});
