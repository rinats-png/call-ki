import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireAuth, requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LIST = { id: true, number: true, year: true, month: true, issuedAt: true, dueAt: true, grossCents: true, netCents: true, partial: true, tenantId: true } as const;

/** Rechnungen: Kunden-Admin sieht die eigenen, Plattform-Admin alle eines Monats (?month=JJJJ-MM) */
export const GET = api(async (req) => {
  const auth = await requireAuth();
  if (auth.isPlatformAdmin && !auth.tenantId) {
    const m = new URL(req.url).searchParams.get("month") ?? "";
    const [year, month] = m.split("-").map(Number);
    const rows = await prisma.invoice.findMany({ where: year && month ? { year, month } : {}, orderBy: { number: "desc" }, take: 500, select: { ...LIST, recipient: true } });
    return NextResponse.json(rows);
  }
  const t = await requireTenant({ adminOnly: true });
  return NextResponse.json(await prisma.invoice.findMany({ where: { tenantId: t.tenantId }, orderBy: { number: "desc" }, take: 120, select: LIST }));
});
