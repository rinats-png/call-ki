import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { env, microsoftConfigured, retellConfigured, smsConfigured, smtpConfigured } from "@/lib/env";
import { TEMPLATE_OPTIONS } from "@/lib/tenant/templates";
import { webhookUrls } from "@/lib/platform/webhooks";

export const dynamic = "force-dynamic";

/** Plattform-Status: welche zentralen Dienste eingerichtet sind + Webhook-URLs. */
export const GET = api(async () => {
  await requirePlatformAdmin();
  const e = env();
  const [tenants, failedMessages] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.message.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  return NextResponse.json({
    services: {
      twilio: !!(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN),
      retell: retellConfigured(),
      microsoft: microsoftConfigured(),
      smtp: smtpConfigured(),
      sms: smsConfigured(),
      toolSecret: !!(e.VOICE_TOOL_SECRET || e.VOICE_TOOL_SECRET_RETELL || e.VOICE_TOOL_SECRET_VAPI || e.VOICE_TOOL_SECRET_ELEVENLABS || e.VOICE_TOOL_SECRET_SIP),
      cron: !!e.CRON_SECRET,
      encryption: !!process.env.APP_ENCRYPTION_KEY,
      noStorageAgent: !!e.RETELL_AGENT_ID_NO_STORAGE,
    },
    tenants: Object.fromEntries(tenants.map((t) => [t.status, t._count._all])),
    failedMessages7d: failedMessages,
    webhooks: webhookUrls(),
    templates: TEMPLATE_OPTIONS,
  });
});
