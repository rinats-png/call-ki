import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createDemoTenant, demoAllowed } from "@/lib/services/demo";
import { HttpError } from "@/lib/http";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Test-Kunden mit Beispieldaten anlegen (oder vorhandenen zurückgeben) */
export const POST = api(async () => {
  const auth = await requirePlatformAdmin();
  if (!demoAllowed()) throw new HttpError(403, "Test-Kunden gibt es nur in der Testumgebung (DEMO_SEED=true).");
  const r = await createDemoTenant();
  if (r.created) await audit({ tenantId: r.id, userId: auth.user.id, action: "tenant.demo_create" });
  return NextResponse.json(r);
});
