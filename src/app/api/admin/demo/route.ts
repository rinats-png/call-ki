import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createDemoTenant } from "@/lib/services/demo";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Test-Kunden mit Beispieldaten anlegen (oder vorhandenen zurückgeben) */
export const POST = api(async () => {
  const auth = await requirePlatformAdmin();
  const r = await createDemoTenant();
  if (r.created) await audit({ tenantId: r.id, userId: auth.user.id, action: "tenant.demo_create" });
  return NextResponse.json(r);
});
