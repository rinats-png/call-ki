import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/Readiness (öffentlich, ohne Details) – für Docker-Healthcheck & Monitoring. */
export async function GET() {
  await ensurePlatformConfig();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
