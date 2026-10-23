import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  const logs = await prisma.auditLog.findMany({ where: { tenantId: auth.tenantId }, orderBy: { createdAt: "desc" }, take: 200 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])] } }, select: { id: true, email: true } });
  const byId = Object.fromEntries(users.map((u) => [u.id, u.email]));
  return NextResponse.json(logs.map((l) => ({ ...l, userEmail: l.userId ? byId[l.userId] ?? "(gelöscht)" : "System" })));
});
