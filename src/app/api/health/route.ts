import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness/Readiness-Probe (öffentlich, ohne sensible Details). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      // nur Ja/Nein, keine Werte – hilft bei der Einrichtung
      config: { dashboardPassword: !!process.env.DASHBOARD_PASSWORD, voiceSecret: !!process.env.VOICE_TOOL_SECRET },
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
