import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { loadTenant } from "@/lib/tenant";
import { tenantSettingsSchema } from "@/lib/tenant/settings";
import { TEMPLATE_OPTIONS, TEMPLATES } from "@/lib/tenant/templates";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant();
  const { tenant, cfg } = await loadTenant(auth.tenantId);
  const numbers = await prisma.phoneNumber.findMany({ where: { tenantId: tenant.id }, select: { e164: true, label: true, fallbackNumber: true } });
  return NextResponse.json({
    tenant: { id: tenant.id, name: tenant.name, industry: tenant.industry, timezone: tenant.timezone, logoUrl: tenant.logoUrl, status: tenant.status },
    settings: cfg.settings,
    template: { key: cfg.template.key, label: cfg.template.label, categories: cfg.template.categories, urgency: cfg.template.urgency },
    templates: TEMPLATE_OPTIONS,
    numbers,
  });
});

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  industry: z.string().refine((k) => k in TEMPLATES, "Unbekannte Branche").optional(),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("de-DE", { timeZone: tz }); return true; } catch { return false; } }, "Ungültige Zeitzone").optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  settings: tenantSettingsSchema.optional(),
});

export const PUT = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const d = schema.parse(await readJson(req));
  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      ...(d.name ? { name: d.name } : {}),
      ...(d.industry ? { industry: d.industry } : {}),
      ...(d.timezone ? { timezone: d.timezone } : {}),
      ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl || null } : {}),
      ...(d.settings ? { settings: d.settings as Prisma.InputJsonValue } : {}),
    },
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "settings.update", meta: Object.keys(d) });
  return NextResponse.json({ ok: true });
});
