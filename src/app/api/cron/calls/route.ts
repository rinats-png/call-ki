import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { enforceCallLimits, maxCallSeconds } from "@/lib/cost-guard";
import { closeStaleCalls } from "@/lib/services/calls";

export const dynamic = "force-dynamic";

/** Jede Minute per Cron: überlange Gespräche bei Twilio beenden, Anrufe ohne Anbieter-Ende schließen. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ limits: await enforceCallLimits(), stale: await closeStaleCalls(maxCallSeconds()) });
}
