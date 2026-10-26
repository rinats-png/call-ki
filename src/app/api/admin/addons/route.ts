import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ADDONS, ADDON_KEYS, addonPrices } from "@/lib/addons";

export const dynamic = "force-dynamic";

/** Preise der Zusatzoptionen (Betreiber) mit Anzahl aktiver Buchungen */
export const GET = api(async () => {
  await requirePlatformAdmin();
  const prices = await addonPrices();
  const now = new Date();
  const counts = await prisma.tenantAddon.groupBy({ by: ["key"], where: { startedAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, _count: true });
  return NextResponse.json({ addons: ADDONS.map((a) => ({ key: a.key, name: a.name, tagline: a.tagline, ...prices[a.key], bookings: counts.find((c) => c.key === a.key)?._count ?? 0 })) });
});

/** Preis ändern gilt für neue Buchungen; bestehende behalten ihren Preis. */
export const PUT = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const d = z.object({ key: z.enum(ADDON_KEYS as [string, ...string[]]), monthlyPriceCents: z.number().int().min(0).max(1_000_000), active: z.boolean() }).parse(await readJson(req));
  await prisma.addonPrice.upsert({ where: { key: d.key }, create: d, update: { monthlyPriceCents: d.monthlyPriceCents, active: d.active } });
  await audit({ userId: auth.user.id, action: "addon.price", target: d.key, meta: { monthlyPriceCents: d.monthlyPriceCents, active: d.active } });
  return NextResponse.json({ ok: true });
});
