import { api, notFound } from "@/lib/http";
import { requirePlatformAdmin, requireRecentAuth } from "@/lib/auth/session";
import { exportTenantData } from "@/lib/services/tenants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Gesamtexport eines Mandanten (Vertragsende, AVV § 10) */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requirePlatformAdmin();
  requireRecentAuth(auth);
  const { id } = await params;
  const data = await exportTenantData(id);
  if (!data) throw notFound("Mandant");
  await audit({ tenantId: id, userId: auth.user.id, action: "tenant.export" });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="export-${data.slug}.json"` },
  });
});
