import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Löschen; Vorgänge behalten ihre Kategorie, nur die Verknüpfung entfällt */
export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const r = await prisma.service.deleteMany({ where: { id, tenantId: auth.tenantId } });
  if (!r.count) throw notFound("Leistung");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "service.delete", target: id });
  return NextResponse.json({ ok: true });
});
