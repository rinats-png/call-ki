import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { resolveConfig } from "@/lib/tenant/settings";

export const dynamic = "force-dynamic";

/** Aktueller Nutzer + aktiver Mandant (für Navigation, Labels, Branding). */
export const GET = api(async () => {
  const auth = await requireAuth();
  const tenant = auth.tenantId ? await prisma.tenant.findUnique({ where: { id: auth.tenantId } }) : null;
  const cfg = tenant ? resolveConfig(tenant) : null;
  return NextResponse.json({
    user: auth.user,
    isPlatformAdmin: auth.isPlatformAdmin,
    tenant: tenant
      ? {
          id: tenant.id, name: tenant.name, slug: tenant.slug, industry: tenant.industry, status: tenant.status, logoUrl: tenant.logoUrl, timezone: tenant.timezone,
          categories: cfg!.categories, roleLabels: cfg!.template.roleLabels, customerTypeLabels: cfg!.template.customerTypeLabels, jobNoun: cfg!.template.jobNoun,
        }
      : null,
  });
});
