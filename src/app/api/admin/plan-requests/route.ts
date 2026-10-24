import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Offene Paketwechsel-Anfragen aller Kunden */
export const GET = api(async () => {
  await requirePlatformAdmin();
  const rows = await prisma.planChangeRequest.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, planRef: { select: { name: true } } } } } });
  return NextResponse.json(rows.map((r) => ({ id: r.id, tenantId: r.tenantId, tenantName: r.tenant.name, currentPlan: r.tenant.planRef?.name ?? "Ohne Paket", planName: r.planName, note: r.note, createdAt: r.createdAt })));
});
