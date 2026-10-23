import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound, HttpError } from "@/lib/http";
import { requirePlatformAdmin, requireRecentAuth } from "@/lib/auth/session";
import { TENANT_STATUS } from "@/lib/constants";
import { TEMPLATES } from "@/lib/tenant/templates";
import { avvMissing, deleteTenant, tenantUsage } from "@/lib/services/tenants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

export const GET = api<P>(async (_req, { params }) => {
  await requirePlatformAdmin();
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      phoneNumbers: true,
      integrations: { select: { type: true, status: true, lastError: true, updatedAt: true } },
      users: { select: { id: true, email: true, name: true, role: true, disabled: true, lastLoginAt: true, passwordHash: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!tenant) throw notFound("Mandant");
  const usage = (await tenantUsage([id]))[id];
  return NextResponse.json({ ...tenant, users: tenant.users.map(({ passwordHash, ...u }) => ({ ...u, invitePending: !passwordHash })), usage });
});

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(TENANT_STATUS).optional(),
  industry: z.string().refine((k) => k in TEMPLATES).optional(),
  plan: z.string().max(40).optional(),
  monthlyMinuteLimit: z.number().int().min(0).nullable().optional(),
  avvVersion: z.string().trim().max(40).nullable().optional(),
  avvSignedAt: z.coerce.date().nullable().optional(),
});

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const current = await prisma.tenant.findUnique({ where: { id }, select: { status: true, avvVersion: true, avvSignedAt: true } });
  if (!current) throw notFound("Mandant");
  const next = { ...current, ...d, avvVersion: d.avvVersion === undefined ? current.avvVersion : d.avvVersion || null };
  // Produktivbetrieb nur mit abgeschlossenem AVV (Art. 28 DSGVO, docs/recht/avv-vorlage.md)
  const touchesAvv = d.status === "ACTIVE" || d.avvVersion !== undefined || d.avvSignedAt !== undefined;
  if (next.status === "ACTIVE" && avvMissing(next) && touchesAvv) {
    throw new HttpError(409, "Bitte zuerst AVV-Version und Abschlussdatum eintragen – ohne Auftragsverarbeitungsvertrag kein Produktivbetrieb.");
  }
  const t = await prisma.tenant.update({ where: { id }, data: { ...d, avvVersion: next.avvVersion } });
  await audit({ tenantId: id, userId: auth.user.id, action: "tenant.update", meta: d });
  return NextResponse.json(t);
});

const deleteSchema = z.object({ confirmSlug: z.string(), force: z.boolean().optional() });

/** Vertragsende: Mandant samt aller Daten endgültig löschen (inkl. Retell/Twilio). */
export const DELETE = api<P>(async (req, { params }) => {
  const auth = await requirePlatformAdmin();
  requireRecentAuth(auth);
  const { id } = await params;
  const d = deleteSchema.parse(await readJson(req));
  const t = await prisma.tenant.findUnique({ where: { id }, select: { slug: true, status: true } });
  if (!t) throw notFound("Mandant");
  if (t.status !== "PAUSED") throw new HttpError(409, "Bitte den Mandanten zuerst pausieren und den Gesamtexport sichern.");
  if (d.confirmSlug !== t.slug) throw new HttpError(400, "Die Bestätigung stimmt nicht mit der Kennung des Mandanten überein.");
  const r = await deleteTenant(id, { force: d.force });
  if (!r.deleted) {
    throw new HttpError(409, `${r.providerFailed} Anruf(e) konnten bei Retell/Twilio nicht gelöscht werden. Später erneut versuchen oder trotzdem löschen.`, { code: "PROVIDER_INCOMPLETE" });
  }
  // Nach der Löschung ohne Mandantenbezug protokollieren (Mandanten-Logs sind mitgelöscht)
  await audit({ userId: auth.user.id, action: "tenant.delete", target: id, meta: { slug: t.slug, providerFailed: r.providerFailed, forced: !!d.force } });
  return NextResponse.json({ ok: true, providerFailed: r.providerFailed });
});
