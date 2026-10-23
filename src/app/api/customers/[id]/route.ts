import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, badRequest } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { normalizePostalCode } from "@/lib/postal";
import { cleanEmail, eraseCustomer } from "@/lib/services/customers";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const c = await prisma.customer.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      tickets: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, category: true, urgency: true, status: true, summary: true, appointmentStart: true, createdAt: true } },
      calls: { orderBy: { startedAt: "desc" }, take: 50, select: { id: true, startedAt: true, durationSec: true, status: true, summary: true } },
    },
  });
  if (!c) throw notFound("Kunde");
  return NextResponse.json(c);
});

const patchSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  companyName: z.string().max(160).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  postalCode: z.string().max(10).nullable().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  notes: z.string().max(8000).nullable().optional(),
});

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const d = patchSchema.parse(await readJson(req));
  if (!(await prisma.customer.count({ where: { id, tenantId: auth.tenantId } }))) throw notFound("Kunde");
  if (d.email && !cleanEmail(d.email)) throw badRequest("Ungültige E-Mail-Adresse");
  const c = await prisma.customer.update({
    where: { id },
    data: { ...d, ...(d.email !== undefined ? { email: d.email ? cleanEmail(d.email) : null } : {}), ...(d.postalCode !== undefined ? { postalCode: normalizePostalCode(d.postalCode) } : {}) },
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "customer.update", target: id });
  return NextResponse.json(c);
});

/** DSGVO-Löschung (nur Admins) */
export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  if (!(await eraseCustomer(auth.tenantId, id))) throw notFound("Kunde");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "customer.erase", target: id });
  return NextResponse.json({ ok: true });
});
