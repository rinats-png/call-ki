import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, HttpError } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";
import { providerFor } from "@/lib/voice/handoff";
import { ensureVapiSipNumber } from "@/lib/voice/vapi";
import { isVoiceProvider } from "@/lib/platform/voice-options";

export const dynamic = "force-dynamic";
type P = { id: string };

const schema = z.object({
  e164: z.string(),
  label: z.string().max(60).optional(),
  voiceAgentId: z.string().max(80).optional(),
  voiceProvider: z.string().max(40).refine((v) => v === "" || isVoiceProvider(v), "Unbekannter Anbieter").optional(),
  fallbackNumber: z.string().max(30).optional(),
});

/** Twilio-Nummer einem Mandanten zuordnen (bzw. Einstellungen aktualisieren). */
export const POST = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const e164 = normalizePhone(d.e164);
  if (!e164) throw new HttpError(400, "Ungültige Nummer");
  const existing = await prisma.phoneNumber.findUnique({ where: { e164 } });
  if (existing && existing.tenantId !== id) throw new HttpError(409, "Nummer ist einem anderen Kunden zugeordnet.");
  const data = { label: d.label || null, voiceAgentId: d.voiceAgentId || null, voiceProvider: d.voiceProvider || null, fallbackNumber: normalizePhone(d.fallbackNumber) };
  const n = await prisma.phoneNumber.upsert({ where: { e164 }, create: { tenantId: id, e164, ...data }, update: data });
  await audit({ tenantId: id, userId: auth.user.id, action: "number.assign", target: e164 });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id } });
  const vapi = providerFor(n, tenant).provider === "vapi" ? await ensureVapiSipNumber(e164) : null;
  return NextResponse.json({ ...n, notice: vapi?.message ?? null });
});

export const DELETE = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const e164 = normalizePhone(new URL(req.url).searchParams.get("e164"));
  if (!e164) throw new HttpError(400, "Nummer fehlt");
  await prisma.phoneNumber.deleteMany({ where: { e164, tenantId: id } });
  await audit({ tenantId: id, userId: auth.user.id, action: "number.remove", target: e164 });
  return NextResponse.json({ ok: true });
});
