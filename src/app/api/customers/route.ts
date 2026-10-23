import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { companyName: { contains: q } }, { phone: { contains: q } }, { postalCode: { startsWith: q } }, { email: { contains: q } }] }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { _count: { select: { tickets: true } }, tickets: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, pestType: true } } },
  });
  return NextResponse.json(customers);
}
