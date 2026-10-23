import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { microsoftConfigured, retellConfigured, smsConfigured, smtpConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant();
  const [ms, numbers] = await Promise.all([
    prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: "MICROSOFT_365" } } }),
    prisma.phoneNumber.findMany({ where: { tenantId: auth.tenantId }, select: { e164: true, label: true, fallbackNumber: true } }),
  ]);
  const cfg = (ms?.config ?? {}) as { msTenantId?: string; draftMailbox?: string };
  return NextResponse.json({
    platform: { microsoftAvailable: microsoftConfigured(), email: smtpConfigured(), sms: smsConfigured(), voice: retellConfigured() },
    microsoft: ms ? { status: ms.status, msTenantId: cfg.msTenantId ?? null, draftMailbox: cfg.draftMailbox ?? "", lastError: ms.lastError, updatedAt: ms.updatedAt } : { status: "DISCONNECTED" },
    numbers,
  });
});
