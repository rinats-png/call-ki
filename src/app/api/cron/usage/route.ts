import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { runQuotaWarnings } from "@/lib/services/usage-alerts";

export const dynamic = "force-dynamic";

/** Alle 15 Minuten per Cron: Kontingent-Warnungen und Tagesbudget. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runQuotaWarnings());
}
