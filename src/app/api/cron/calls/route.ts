import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { enforceCallLimits } from "@/lib/cost-guard";

export const dynamic = "force-dynamic";

/** Jede Minute per Cron: Gespräche über der Höchstdauer bei Twilio beenden. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await enforceCallLimits());
}
