import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { runMonitor } from "@/lib/services/monitor";

export const dynamic = "force-dynamic";

/** Alle 5 Minuten per Cron: Betrieb prüfen und Betreiber alarmieren. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runMonitor());
}
