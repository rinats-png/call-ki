import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError, notFound } from "@/lib/http";
import { requirePlatformAdmin, requireRecentAuth } from "@/lib/auth/session";
import { smtpConfigured } from "@/lib/env";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/services/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

const schema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()).optional(),
  name: z.string().max(80).optional(),
  role: z.enum(["TENANT_ADMIN", "TENANT_USER"]).default("TENANT_ADMIN"),
  /** Für bestehende Nutzer: neuen Link erzeugen */
  userId: z.string().optional(),
});

/** Nutzer einladen oder Zugangslink neu erzeugen (Support). */
export const POST = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw notFound("Mandant");

  if (d.userId) {
    requireRecentAuth(auth); // Zugangslink für fremdes Konto = Übernahme möglich
    const user = await prisma.user.findFirst({ where: { id: d.userId, tenantId: id } });
    if (!user) throw notFound("Benutzer");
    const link = user.passwordHash ? await sendPasswordResetEmail(user) : await sendInviteEmail(user, tenant.name);
    await audit({ tenantId: id, userId: auth.user.id, action: "user.link_issued", target: user.id });
    return NextResponse.json({ link: smtpConfigured() ? null : link });
  }
  if (!d.email) throw new HttpError(400, "E-Mail fehlt");
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new HttpError(409, "Diese E-Mail hat bereits einen Zugang.");
  const user = await prisma.user.create({ data: { email: d.email, name: d.name, role: d.role, tenantId: id } });
  const link = await sendInviteEmail(user, tenant.name);
  await audit({ tenantId: id, userId: auth.user.id, action: "user.invite", target: user.id });
  return NextResponse.json({ id: user.id, link: smtpConfigured() ? null : link }, { status: 201 });
});
