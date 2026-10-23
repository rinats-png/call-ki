import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant();
  const messages = await prisma.message.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, channel: true, recipient: true, subject: true, purpose: true, status: true, error: true, provider: true, ticketId: true, createdAt: true },
  });
  return NextResponse.json(messages);
});
