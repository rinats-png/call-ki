import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { runAppointmentReminders } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

/** Alle 15 Minuten per Cron: Terminerinnerungen an Kunden. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runAppointmentReminders());
}
