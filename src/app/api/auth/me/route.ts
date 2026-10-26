import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { resolveConfig } from "@/lib/tenant/settings";
import { activeModules } from "@/lib/addons";

export const dynamic = "force-dynamic";

/** Aktueller Nutzer + aktiver Mandant (für Navigation, Labels, Branding). */
export const GET = api(async () => {
  const auth = await requireAuth({ allowMfaSetup: true });
  const tenant = auth.tenantId ? await prisma.tenant.findUnique({ where: { id: auth.tenantId } }) : null;
  const cfg = tenant ? resolveConfig(tenant) : null;
  // Rechnungsarchiv bleibt nach Kündigung sichtbar (Aufbewahrungspflicht)
  const [modules, hasBills] = tenant ? await Promise.all([activeModules(tenant.id), prisma.bill.count({ where: { tenantId: tenant.id, status: { not: "DRAFT" } } }).then((n) => n > 0)]) : [[], false];
  return NextResponse.json({
    user: auth.user,
    isPlatformAdmin: auth.isPlatformAdmin,
    mfa: { enabled: auth.mfaEnabled, setupRequired: auth.mfaSetupRequired },
    tenant: tenant
      ? {
          id: tenant.id, name: tenant.name, slug: tenant.slug, industry: tenant.industry, status: tenant.status, logoUrl: tenant.logoUrl, timezone: tenant.timezone,
          categories: cfg!.categories, roleLabels: cfg!.template.roleLabels, customerTypeLabels: cfg!.template.customerTypeLabels, jobNoun: cfg!.template.jobNoun,
          modules, hasBills,
        }
      : null,
  });
});
