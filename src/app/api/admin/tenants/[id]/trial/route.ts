import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { extendTrial, startTrial } from "@/lib/trial";

export const dynamic = "force-dynamic";

/** Testphase starten, verlängern oder sofort beenden (Betreiber) */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  if (!(await prisma.tenant.count({ where: { id } }))) throw notFound("Kunde");
  const d = z.discriminatedUnion("action", [
    z.object({ action: z.literal("start"), days: z.number().int().min(1).max(180).optional(), minutes: z.number().int().min(0).max(10_000).optional() }),
    z.object({ action: z.literal("extend"), days: z.number().int().min(1).max(90) }),
    z.object({ action: z.literal("end") }),
  ]).parse(await readJson(req));
  if (d.action === "start") await startTrial(id, { days: d.days, minutes: d.minutes });
  else if (d.action === "extend") await extendTrial(id, d.days);
  else await prisma.tenant.update({ where: { id }, data: { trialEndsAt: new Date() } }); // Cron stellt um bzw. pausiert
  await audit({ tenantId: id, userId: auth.user.id, action: `trial.${d.action}`, meta: d });
  return NextResponse.json({ ok: true });
});
