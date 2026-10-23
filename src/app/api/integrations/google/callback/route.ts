import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getAuth } from "@/lib/auth/session";
import { safeEqual } from "@/lib/security";
import { exchangeGoogleCode, GOOGLE_TYPE, sealToken } from "@/lib/google";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Rücksprung nach der Google-Anmeldung: ?code=…&state=<tenantId>.<nonce> bzw. ?error=… */
export async function GET(req: Request) {
  await ensurePlatformConfig();
  const u = new URL(req.url).searchParams;
  const back = (q: string) => NextResponse.redirect(`${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/settings/integrations?${q}`);
  const auth = await getAuth();
  const [tenantId, nonce] = (u.get("state") ?? "").split(".");
  if (!auth || !tenantId || auth.tenantId !== tenantId) return back("google=error&reason=session");
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: GOOGLE_TYPE } } });
  const cfg = (integ?.config ?? {}) as { pendingState?: string };
  if (!integ || !cfg.pendingState || !nonce || !safeEqual(cfg.pendingState, nonce)) return back("google=error&reason=state");
  const code = u.get("code");
  if (u.get("error") || !code) {
    const msg = u.get("error") ?? "Zustimmung nicht erteilt";
    await prisma.integration.update({ where: { id: integ.id }, data: { status: "ERROR", lastError: msg, config: {} } });
    return back(`google=error&reason=${encodeURIComponent(msg)}`);
  }
  try {
    const { refreshToken, email } = await exchangeGoogleCode(code);
    await prisma.integration.update({ where: { id: integ.id }, data: { status: "CONNECTED", lastError: null, secretEnc: sealToken(refreshToken), config: { account: email } } });
    await audit({ tenantId, userId: auth.user.id, action: "integration.google.connect", meta: { account: email } });
    return back("google=connected");
  } catch (err) {
    logger.error("google.callback_failed", { tenantId, error: (err as Error).message });
    await prisma.integration.update({ where: { id: integ.id }, data: { status: "ERROR", lastError: (err as Error).message.slice(0, 300), config: {} } });
    return back(`google=error&reason=${encodeURIComponent((err as Error).message.slice(0, 120))}`);
  }
}
