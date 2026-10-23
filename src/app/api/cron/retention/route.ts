import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security";
import { runRetention } from "@/lib/services/retention";

export const dynamic = "force-dynamic";

/** Täglich per Cron aufrufen (siehe docker-compose: Dienst "cron"). Authorization: Bearer CRON_SECRET */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runRetention());
}
