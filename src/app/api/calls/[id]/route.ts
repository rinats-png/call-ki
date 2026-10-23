import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const call = await prisma.call.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { customer: true, tickets: { select: { id: true, category: true, urgency: true, status: true, summary: true } } },
  });
  if (!call) throw notFound("Anruf");
  return NextResponse.json({ ...call, recordingUrl: call.recordingUrl ? `/api/calls/${call.id}/recording` : null });
});
