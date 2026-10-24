import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { recordHeartbeat } from "@/lib/services/monitor";

export const dynamic = "force-dynamic";

const JOBS = new Set(["backup", "restore-test"]);

/** Lebenszeichen externer Jobs, z. B. ?job=backup&ok=1&note=… vom Backup-Dienst. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const job = u.searchParams.get("job") ?? "";
  if (!JOBS.has(job)) return NextResponse.json({ error: "Unbekannter Job" }, { status: 400 });
  await recordHeartbeat(job, u.searchParams.get("ok") === "1", u.searchParams.get("note") ?? "");
  return NextResponse.json({ ok: true });
}
