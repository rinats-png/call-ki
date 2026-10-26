import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ADDONS, ADDON_KEYS, activeModules, addonPrices, bookAddon, cancelAddon } from "@/lib/addons";

export const dynamic = "force-dynamic";

/** Zusatzoptionen mit Preis und Status (gebucht, im Paket, gekündigt zum …) */
export const GET = api(async () => {
  const auth = await requireTenant();
  const now = new Date();
  const [prices, active, rows, t] = await Promise.all([
    addonPrices(),
    activeModules(auth.tenantId, now),
    prisma.tenantAddon.findMany({ where: { tenantId: auth.tenantId, startedAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { planRef: { select: { features: true, name: true } } } }),
  ]);
  return NextResponse.json({
    addons: ADDONS.map((a) => {
      const row = rows.find((r) => r.key === a.key);
      const inPlan = !!t.planRef?.features.includes(a.key);
      return { ...a, priceCents: row?.priceCents ?? prices[a.key].priceCents, available: prices[a.key].active, active: active.includes(a.key), inPlan, bookedAt: row?.startedAt ?? null, endsAt: row?.endsAt ?? null };
    }),
  });
});

/** Hinzubuchen bzw. zum Monatsende kündigen (nur Kunden-Admins) */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const d = z.object({ key: z.enum(ADDON_KEYS as [string, ...string[]]), action: z.enum(["book", "cancel"]) }).parse(await readJson(req));
  const key = d.key as (typeof ADDON_KEYS)[number];
  const r = d.action === "book" ? await bookAddon(auth.tenantId, key, { userId: auth.user.id }) : await cancelAddon(auth.tenantId, key);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `addon.${d.action}`, target: key, meta: { priceCents: r.priceCents, endsAt: r.endsAt?.toISOString() ?? null } });
  return NextResponse.json({ ok: true, endsAt: r.endsAt });
});
