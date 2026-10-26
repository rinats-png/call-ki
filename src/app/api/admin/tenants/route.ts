import { NextResponse } from "next/server";
import { startTrial } from "@/lib/trial";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { autoSeedDemo } from "@/lib/services/demo";
import { smtpConfigured } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { TEMPLATES } from "@/lib/tenant/templates";
import { createTenant, tenantUsage } from "@/lib/services/tenants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePlatformAdmin();
  await autoSeedDemo();
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      phoneNumbers: { select: { e164: true } },
      integrations: { select: { type: true, status: true } },
      _count: { select: { users: true, employees: true, customers: true } },
    },
  });
  const usage = await tenantUsage(tenants.map((t) => t.id));
  return NextResponse.json(tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug, industry: t.industry, status: t.status, plan: t.plan, monthlyMinuteLimit: t.monthlyMinuteLimit, createdAt: t.createdAt, phoneNumbers: t.phoneNumbers, integrations: t.integrations, _count: t._count, usage: usage[t.id] })));
});

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().refine((k) => k in TEMPLATES, "Unbekannte Branche"),
  adminEmail: z.string().email().transform((e) => e.toLowerCase().trim()),
  adminName: z.string().trim().max(80).optional(),
  phoneNumber: z.string().optional(),
  monthlyMinuteLimit: z.number().int().min(0).nullable().optional(),
  plan: z.string().max(40).optional(),
  /** Als Testkunde anlegen (Testphase laut Plattform-Einstellung) */
  trial: z.boolean().default(false),
});

export const POST = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const d = schema.parse(await readJson(req));
  if (await prisma.user.findUnique({ where: { email: d.adminEmail } })) throw new HttpError(409, "Für diese E-Mail existiert bereits ein Zugang.");
  const phone = d.phoneNumber ? normalizePhone(d.phoneNumber) : null;
  if (d.phoneNumber && !phone) throw new HttpError(400, "Ungültige Telefonnummer.");
  if (phone && (await prisma.phoneNumber.findUnique({ where: { e164: phone } }))) throw new HttpError(409, "Diese Nummer ist bereits vergeben.");
  const { trial, ...rest } = d;
  const { tenant, inviteLink } = await createTenant({ ...rest, phoneNumber: phone });
  if (trial) await startTrial(tenant.id);
  await audit({ tenantId: tenant.id, userId: auth.user.id, action: "tenant.create", meta: { name: tenant.name } });
  return NextResponse.json({ tenant, inviteLink: smtpConfigured() ? null : inviteLink }, { status: 201 });
});
