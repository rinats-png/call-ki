import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, readJson, notFound, HttpError } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { planSchema } from "../schema";

export const dynamic = "force-dynamic";
type P = { id: string };

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const d = planSchema.partial().parse(await readJson(req));
  if (d.key) {
    const other = await prisma.plan.findUnique({ where: { key: d.key } });
    if (other && other.id !== id) throw new HttpError(409, "Ein Paket mit diesem Kürzel gibt es schon.");
  }
  const plan = await prisma.plan.update({ where: { id }, data: d }).catch(() => null);
  if (!plan) throw notFound("Paket");
  await audit({ userId: auth.user.id, action: "plan.update", target: id, meta: d });
  return NextResponse.json(plan);
});

/** Löschen nur ohne zugeordnete Kunden – sonst deaktivieren */
export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const count = await prisma.tenant.count({ where: { planId: id } });
  if (count > 0) throw new HttpError(409, `${count} Kunde(n) nutzen dieses Paket – bitte deaktivieren statt löschen.`);
  await prisma.plan.delete({ where: { id } }).catch(() => { throw notFound("Paket"); });
  await audit({ userId: auth.user.id, action: "plan.delete", target: id });
  return NextResponse.json({ ok: true });
});
