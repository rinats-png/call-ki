import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ADDON_KEYS, bookAddon, cancelAddon } from "@/lib/addons";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Zusatzoption für einen Kunden freischalten (Standardpreis oder kostenlos) bzw. beenden */
export const POST = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  if (!(await prisma.tenant.count({ where: { id } }))) throw notFound("Kunde");
  const d = z.object({ key: z.enum(ADDON_KEYS as [string, ...string[]]), action: z.enum(["book", "cancel", "end_now"]), free: z.boolean().default(false) }).parse(await readJson(req));
  const key = d.key as (typeof ADDON_KEYS)[number];
  const r = d.action === "book" ? await bookAddon(id, key, { userId: auth.user.id, ...(d.free ? { priceCents: 0 } : {}) }) : await cancelAddon(id, key, { immediate: d.action === "end_now" });
  await audit({ tenantId: id, userId: auth.user.id, action: `addon.admin_${d.action}`, target: key, meta: { priceCents: r.priceCents } });
  return NextResponse.json({ ok: true });
});
