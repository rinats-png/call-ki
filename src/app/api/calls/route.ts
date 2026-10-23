import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Anrufprotokoll inkl. Anrufe ohne Vorgang (aufgelegt, Fehlwahl, Mailbox). */
export const GET = api(async (req) => {
  const auth = await requireTenant();
  const u = new URL(req.url).searchParams;
  const cursor = u.get("cursor");
  const calls = await prisma.call.findMany({
    where: { tenantId: auth.tenantId, ...(u.get("status") ? { status: u.get("status")! } : {}) },
    orderBy: { startedAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, fromNumber: true, status: true, startedAt: true, durationSec: true, summary: true, endReason: true, recordingUrl: true,
      customer: { select: { id: true, name: true, companyName: true } },
      tickets: { select: { id: true, category: true, urgency: true, status: true } },
    },
  });
  // Anbieter-URL nicht herausgeben – Abspielen nur über /api/calls/[id]/recording
  const out = calls.slice(0, 50).map(({ recordingUrl, ...c }) => ({ ...c, recordingUrl: recordingUrl ? `/api/calls/${c.id}/recording` : null }));
  return NextResponse.json({ calls: out, nextCursor: calls.length > 50 ? calls[49].id : null });
});
