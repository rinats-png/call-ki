import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const GET = api(async (req) => {
  const auth = await requireTenant();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { postalCode: { startsWith: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { _count: { select: { tickets: true, calls: true } }, tickets: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, category: true } } },
  });
  return NextResponse.json(customers);
});
