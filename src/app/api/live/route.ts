import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { liveCalls } from "@/lib/services/live";

export const dynamic = "force-dynamic";

/** Live-Konsole: laufende Gespräche des Betriebs */
export const GET = api(async () => {
  const auth = await requireTenant();
  return NextResponse.json({ calls: await liveCalls(auth.tenantId) }, { headers: { "Cache-Control": "no-store" } });
});
