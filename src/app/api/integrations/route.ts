import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { microsoftConfigured, smsConfigured, smtpConfigured } from "@/lib/env";
import { GOOGLE_TYPE, googleConfigured } from "@/lib/google";
import { hasFeature, planForTenant } from "@/lib/billing";
import { setting } from "@/lib/platform/config";
import { getOverlay } from "@/lib/platform/overlay";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant();
  const [ms, google, numbers, { plan }] = await Promise.all([
    prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: "MICROSOFT_365" } } }),
    prisma.integration.findUnique({ where: { tenantId_type: { tenantId: auth.tenantId, type: GOOGLE_TYPE } } }),
    prisma.phoneNumber.findMany({ where: { tenantId: auth.tenantId }, select: { e164: true, label: true, fallbackNumber: true } }),
    planForTenant(auth.tenantId),
  ]);
  const voice = !!(setting("RETELL_API_KEY") || setting("VAPI_API_KEY") || setting("ELEVENLABS_API_KEY") || [...Object.keys(process.env), ...Object.keys(getOverlay())].some((k) => /^SIP_.*_URI$/.test(k) && !!setting(k)));
  const cfg = (ms?.config ?? {}) as { msTenantId?: string; draftMailbox?: string };
  return NextResponse.json({
    platform: { microsoftAvailable: microsoftConfigured(), googleAvailable: googleConfigured(), email: smtpConfigured(), sms: smsConfigured(), voice },
    planAllowsCalendar: hasFeature(plan, "calendar_external"),
    google: google ? { status: google.status, account: (google.config as { account?: string | null }).account ?? null, lastError: google.lastError } : { status: "DISCONNECTED" },
    microsoft: ms ? { status: ms.status, msTenantId: cfg.msTenantId ?? null, draftMailbox: cfg.draftMailbox ?? "", lastError: ms.lastError, updatedAt: ms.updatedAt } : { status: "DISCONNECTED" },
    numbers,
  });
});
