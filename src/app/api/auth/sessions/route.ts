import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Eigene aktive Sitzungen (Geräte) */
export const GET = api(async () => {
  const auth = await requireAuth({ allowMfaSetup: true });
  const sessions = await prisma.session.findMany({
    where: { userId: auth.user.id, mfaVerified: true, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });
  // Sitzungs-IDs nicht vollständig herausgeben
  return NextResponse.json(sessions.map((s) => ({ ref: s.id.slice(0, 12), userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.id === auth.sessionId })));
});

/** Alle anderen Sitzungen abmelden */
export const DELETE = api(async () => {
  const auth = await requireAuth({ allowMfaSetup: true });
  const r = await prisma.session.deleteMany({ where: { userId: auth.user.id, id: { not: auth.sessionId } } });
  await audit({ tenantId: auth.user.tenantId, userId: auth.user.id, action: "auth.sessions_revoked", meta: { count: r.count } });
  return NextResponse.json({ ok: true, revoked: r.count });
});
