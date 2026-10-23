import { api, notFound } from "@/lib/http";
import { requireRecentAuth, requireTenant } from "@/lib/auth/session";
import { exportCustomerData } from "@/lib/services/customers";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** DSGVO-Auskunft als JSON-Download */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireTenant();
  requireRecentAuth(auth);
  const { id } = await params;
  const data = await exportCustomerData(auth.tenantId, id);
  if (!data) throw notFound("Kunde");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "customer.export", target: id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="auskunft-${id}.json"` },
  });
});
