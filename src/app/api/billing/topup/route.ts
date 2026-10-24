import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireRecentAuth, requireTenant } from "@/lib/auth/session";
import { bookMinutePack } from "@/lib/services/billing-requests";

export const dynamic = "force-dynamic";

/** Minutenpaket für den laufenden Monat buchen (Kunden-Admin, kostenpflichtig → frische Bestätigung) */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  requireRecentAuth(auth);
  const { minutes } = z.object({ minutes: z.number().int() }).parse(await readJson(req));
  const top = await bookMinutePack(auth.tenantId, auth.user.id, minutes);
  return NextResponse.json({ ok: true, minutes: top.minutes, priceCents: top.priceCents }, { status: 201 });
});
