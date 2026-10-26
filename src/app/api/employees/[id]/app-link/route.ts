import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { issueAppToken, revokeAppToken } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Geräte-Link für die Techniker-App erzeugen (wird nur einmal angezeigt; alter Link wird ungültig) */
export const POST = api<P>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const token = await issueAppToken(auth.tenantId, id);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "employee.app_link", target: id });
  return NextResponse.json({ url: `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/t/${token}` }, { headers: { "Cache-Control": "no-store" } });
});

export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  await revokeAppToken(auth.tenantId, id);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "employee.app_link_revoke", target: id });
  return NextResponse.json({ ok: true });
});
