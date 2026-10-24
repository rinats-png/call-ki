import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Eine Rechnung – für Kunden-Admins des Empfängers oder Plattform-Admins (sonst 404) */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireAuth();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  const allowed = inv && (auth.isPlatformAdmin || (auth.tenantId === inv.tenantId && auth.user.role === "TENANT_ADMIN"));
  if (!allowed) throw notFound("Rechnung");
  return NextResponse.json(inv);
});
