import { api, notFound } from "@/lib/http";
import { requireRecentAuth, requireTenant } from "@/lib/auth/session";
import { exportTenantData } from "@/lib/services/tenants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Gesamtexport aller eigenen Daten durch den Kunden-Admin (Datenrückgabe, AVV § 10) */
export const GET = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  requireRecentAuth(auth);
  const data = await exportTenantData(auth.tenantId);
  if (!data) throw notFound("Mandant");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "tenant.export" });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="export-${data.slug}.json"` },
  });
});
