import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { runRetention } from "@/lib/services/retention";

export const dynamic = "force-dynamic";

/** Täglich per Cron aufrufen (siehe docker-compose: Dienst "cron"). Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runRetention());
}
