import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { TENANT_STATUS } from "@/lib/constants";
import { TEMPLATES } from "@/lib/tenant/templates";
import { tenantUsage } from "@/lib/services/tenants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = api<P>(async (_req, { params }) => {
  await requirePlatformAdmin();
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      phoneNumbers: true,
      integrations: { select: { type: true, status: true, lastError: true, updatedAt: true } },
      users: { select: { id: true, email: true, name: true, role: true, disabled: true, lastLoginAt: true, passwordHash: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!tenant) throw notFound("Mandant");
  const usage = (await tenantUsage([id]))[id];
  return NextResponse.json({ ...tenant, users: tenant.users.map(({ passwordHash, ...u }) => ({ ...u, invitePending: !passwordHash })), usage });
});

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(TENANT_STATUS).optional(),
  industry: z.string().refine((k) => k in TEMPLATES).optional(),
  plan: z.string().max(40).optional(),
  monthlyMinuteLimit: z.number().int().min(0).nullable().optional(),
});

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const t = await prisma.tenant.update({ where: { id }, data: d }).catch(() => null);
  if (!t) throw notFound("Mandant");
  await audit({ tenantId: id, userId: auth.user.id, action: "tenant.update", meta: d });
  return NextResponse.json(t);
});
