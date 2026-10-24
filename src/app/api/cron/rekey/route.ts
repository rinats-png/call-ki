import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { cronAuthorized } from "@/lib/cron-auth";
import { resealAll } from "@/lib/services/rekey";

export const dynamic = "force-dynamic";

/** Nach einem Schlüsselwechsel: alle Geheimnisse mit dem neuen APP_ENCRYPTION_KEY verschlüsseln. Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await resealAll());
}
