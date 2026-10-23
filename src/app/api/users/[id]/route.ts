import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { smtpConfigured } from "@/lib/env";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/services/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

const schema = z.object({ role: z.enum(["TENANT_ADMIN", "TENANT_USER"]).optional(), disabled: z.boolean().optional(), action: z.enum(["resend_invite", "reset_password"]).optional() });

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const user = await prisma.user.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!user) throw notFound("Benutzer");
  if (user.id === auth.user.id && (d.disabled || d.role === "TENANT_USER")) throw new HttpError(400, "Sie können sich nicht selbst sperren oder herabstufen.");

  let link: string | null = null;
  if (d.action === "resend_invite") link = await sendInviteEmail(user, null);
  if (d.action === "reset_password") link = await sendPasswordResetEmail(user);
  if (d.role || d.disabled !== undefined) {
    await prisma.user.update({ where: { id }, data: { ...(d.role ? { role: d.role } : {}), ...(d.disabled !== undefined ? { disabled: d.disabled } : {}) } });
    if (d.disabled) await prisma.session.deleteMany({ where: { userId: id } });
  }
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "user.update", target: id, meta: d });
  return NextResponse.json({ ok: true, link: smtpConfigured() ? null : link });
});
