import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { retryDueMessages } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Jede Minute per Cron: fehlgeschlagene E-Mails/SMS erneut senden. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await retryDueMessages());
}
