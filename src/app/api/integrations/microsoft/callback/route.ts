import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getAuth } from "@/lib/auth/session";
import { safeEqual } from "@/lib/security";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Rücksprung nach dem Microsoft-Admin-Consent:
 * ?admin_consent=True&tenant=<MS-Tenant-ID>&state=<tenantId>.<nonce>  bzw. ?error=…&error_description=…
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const back = (q: string) => NextResponse.redirect(`${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/settings/integrations?${q}`);
  const auth = await getAuth();
  const [tenantId, nonce] = (u.get("state") ?? "").split(".");
  if (!auth || !tenantId || auth.tenantId !== tenantId) return back("ms=error&reason=session");

  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: "MICROSOFT_365" } } });
  const cfg = (integ?.config ?? {}) as { pendingState?: string; draftMailbox?: string };
  if (!integ || !cfg.pendingState || !nonce || !safeEqual(cfg.pendingState, nonce)) return back("ms=error&reason=state");

  if (u.get("error") || u.get("admin_consent") !== "True" || !u.get("tenant")) {
    const msg = u.get("error_description")?.slice(0, 300) ?? u.get("error") ?? "Zustimmung nicht erteilt";
    await prisma.integration.update({ where: { id: integ.id }, data: { status: "ERROR", lastError: msg, config: { draftMailbox: cfg.draftMailbox } } });
    return back(`ms=error&reason=${encodeURIComponent(msg)}`);
  }

  await prisma.integration.update({
    where: { id: integ.id },
    data: { status: "CONNECTED", lastError: null, config: { msTenantId: u.get("tenant"), draftMailbox: cfg.draftMailbox ?? "" } },
  });
  await audit({ tenantId, userId: auth.user.id, action: "integration.microsoft.connect", meta: { msTenantId: u.get("tenant") } });
  return back("ms=connected");
}
