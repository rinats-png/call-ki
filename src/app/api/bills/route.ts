import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { createDraft, issuerFor } from "@/lib/services/bills";
import { requireModule } from "@/lib/addons";

export const dynamic = "force-dynamic";

/** Belege des Betriebs (Angebote, Rechnungen, Gutschriften) mit Kennzahlen */
export const GET = api(async (req) => {
  const auth = await requireTenant();
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind");
  const status = u.searchParams.get("status");
  const customerId = u.searchParams.get("customerId");
  const where = { tenantId: auth.tenantId, ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(customerId ? { customerId } : {}) };
  const [rows, tenant, open] = await Promise.all([
    prisma.bill.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 300, select: { id: true, kind: true, status: true, number: true, issueDate: true, dueAt: true, grossCents: true, reminderLevel: true, paidAt: true, createdAt: true, customer: { select: { id: true, name: true, companyName: true, phone: true } }, ticketId: true } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { name: true, settings: true } }),
    prisma.bill.aggregate({ where: { tenantId: auth.tenantId, kind: "INVOICE", status: "ISSUED" }, _sum: { grossCents: true }, _count: true }),
  ]);
  const now = Date.now();
  const overdue = rows.filter((r) => r.kind === "INVOICE" && r.status === "ISSUED" && r.dueAt && r.dueAt.getTime() < now);
  const { missing } = issuerFor(tenant);
  return NextResponse.json({ bills: rows, stats: { openCount: open._count, openCents: open._sum.grossCents ?? 0, overdueCount: overdue.length, overdueCents: overdue.reduce((s, r) => s + r.grossCents, 0) }, issuerMissing: missing });
});

const line = z.object({ description: z.string().trim().min(1).max(300), quantity: z.number(), unit: z.string().trim().max(20).default("Stück"), unitCents: z.number().int(), taxRate: z.number().int(), serviceId: z.string().nullable().optional() });
export const POST = api(async (req) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "invoicing");
  const d = z.object({
    kind: z.enum(["QUOTE", "INVOICE"]),
    customerId: z.string().min(1),
    ticketId: z.string().nullable().optional(),
    lines: z.array(line).min(1).max(100),
    serviceDate: z.string().datetime().nullable().optional(),
    introText: z.string().max(1000).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }).parse(await readJson(req));
  const b = await createDraft(auth.tenantId, { ...d, serviceDate: d.serviceDate ? new Date(d.serviceDate) : null, createdById: auth.user.id });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "bill.create", target: b.id, meta: { kind: d.kind } });
  return NextResponse.json(b, { status: 201 });
});
