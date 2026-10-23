import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { smtpConfigured } from "@/lib/env";
import { sendInviteEmail } from "@/lib/services/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant({ adminOnly: true });
  const users = await prisma.user.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, disabled: true, lastLoginAt: true, createdAt: true, passwordHash: true },
  });
  return NextResponse.json(users.map(({ passwordHash, ...u }) => ({ ...u, invitePending: !passwordHash })));
});

const schema = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()), name: z.string().trim().max(80).optional(), role: z.enum(["TENANT_ADMIN", "TENANT_USER"]) });

export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const d = schema.parse(await readJson(req));
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new HttpError(409, "Diese E-Mail-Adresse hat bereits einen Zugang.");
  const user = await prisma.user.create({ data: { email: d.email, name: d.name, role: d.role, tenantId: auth.tenantId } });
  const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { name: true } });
  const link = await sendInviteEmail(user, tenant?.name ?? null);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "user.invite", target: user.id });
  // Ohne SMTP wird der Link direkt angezeigt, damit er manuell weitergegeben werden kann
  return NextResponse.json({ id: user.id, inviteLink: smtpConfigured() ? null : link }, { status: 201 });
});
