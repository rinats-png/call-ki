import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { issuerFor, publicUrl, recipientOf, updateDraft } from "@/lib/services/bills";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const b = await prisma.bill.findFirst({ where: { id, tenantId: auth.tenantId }, include: { customer: true, tenant: { select: { name: true, settings: true } } } });
  if (!b) throw notFound("Beleg");
  const { tenant, ...rest } = b;
  const live = b.status === "DRAFT" ? { issuer: issuerFor(tenant).issuer, recipient: recipientOf(b.customer) } : {};
  const related = b.relatedId ? await prisma.bill.findFirst({ where: { id: b.relatedId, tenantId: auth.tenantId }, select: { id: true, number: true, kind: true } }) : null;
  const children = await prisma.bill.findMany({ where: { relatedId: b.id, tenantId: auth.tenantId }, select: { id: true, number: true, kind: true, status: true } });
  return NextResponse.json({ ...rest, ...live, link: b.status === "DRAFT" ? null : publicUrl(b), related, children, issuerMissing: issuerFor(tenant).missing });
});

const line = z.object({ description: z.string().trim().min(1).max(300), quantity: z.number(), unit: z.string().trim().max(20).default("Stück"), unitCents: z.number().int(), taxRate: z.number().int(), serviceId: z.string().nullable().optional() });
export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const d = z.object({ customerId: z.string().optional(), lines: z.array(line).min(1).max(100).optional(), serviceDate: z.string().datetime().nullable().optional(), introText: z.string().max(1000).nullable().optional(), note: z.string().max(2000).nullable().optional() }).parse(await readJson(req));
  const b = await updateDraft(auth.tenantId, id, { ...d, serviceDate: d.serviceDate === undefined ? undefined : d.serviceDate ? new Date(d.serviceDate) : null });
  return NextResponse.json(b);
});

/** Nur Entwürfe dürfen gelöscht werden (ausgestellte Belege: Aufbewahrungspflicht) */
export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const b = await prisma.bill.findFirst({ where: { id, tenantId: auth.tenantId }, select: { status: true } });
  if (!b) throw notFound("Beleg");
  if (b.status !== "DRAFT") throw new HttpError(409, "Ausgestellte Belege werden nicht gelöscht, sondern storniert.");
  await prisma.bill.delete({ where: { id } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "bill.delete_draft", target: id });
  return NextResponse.json({ ok: true });
});
