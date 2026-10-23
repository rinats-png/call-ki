import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getTemplate } from "../tenant/templates";
import { slugify } from "../tenant";
import { fromZoned, zonedParts } from "../time";
import { sendInviteEmail } from "./users";
import { logger } from "../logger";
import { purgeCallAtProviders } from "../voice/providers";

/** Legt einen neuen Kunden (Mandanten) inkl. Admin-Zugang und Startkonfiguration an. */
export async function createTenant(input: {
  name: string;
  industry: string;
  timezone?: string;
  adminEmail: string;
  adminName?: string;
  phoneNumber?: string | null;
  monthlyMinuteLimit?: number | null;
  plan?: string;
}) {
  const template = getTemplate(input.industry);
  let slug = slugify(input.name);
  for (let i = 2; await prisma.tenant.findUnique({ where: { slug } }); i++) slug = `${slugify(input.name)}-${i}`;

  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name, slug, industry: template.key, timezone: input.timezone ?? "Europe/Berlin",
        plan: input.plan ?? "STARTER", monthlyMinuteLimit: input.monthlyMinuteLimit ?? null,
        settings: {} as Prisma.InputJsonValue,
      },
    });
    const user = await tx.user.create({ data: { email: input.adminEmail, name: input.adminName, role: "TENANT_ADMIN", tenantId: tenant.id } });
    // Startteam: Büro als Auffangstelle, damit Routing sofort funktioniert
    await tx.employee.create({ data: { tenantId: tenant.id, name: "Büro", role: "BACKOFFICE", email: input.adminEmail, servicePostalCodes: "*" } });
    if (input.phoneNumber) await tx.phoneNumber.create({ data: { tenantId: tenant.id, e164: input.phoneNumber } });
    return { tenant, user };
  });
  const inviteLink = await sendInviteEmail(user, tenant.name);
  return { tenant, inviteLink };
}

/** Nutzung je Mandant im laufenden Monat (Plattform-Übersicht, Abrechnung). */
export async function tenantUsage(tenantIds: string[]) {
  const now = new Date();
  const p = zonedParts(now, "Europe/Berlin");
  const monthStart = fromZoned(p.year, p.month, 1, 0, 0, "Europe/Berlin");
  const [calls, tickets] = await Promise.all([
    prisma.call.groupBy({ by: ["tenantId"], where: { tenantId: { in: tenantIds }, startedAt: { gte: monthStart } }, _count: { _all: true }, _sum: { durationSec: true } }),
    prisma.callTicket.groupBy({ by: ["tenantId"], where: { tenantId: { in: tenantIds }, createdAt: { gte: monthStart } }, _count: { _all: true } }),
  ]);
  return Object.fromEntries(
    tenantIds.map((id) => {
      const c = calls.find((x) => x.tenantId === id);
      const t = tickets.find((x) => x.tenantId === id);
      return [id, { calls: c?._count._all ?? 0, minutes: Math.ceil((c?._sum.durationSec ?? 0) / 60), tickets: t?._count._all ?? 0 }];
    }),
  );
}

/** Aktuelle Version der AVV-Vorlage (docs/recht/avv-vorlage.md) */
export const AVV_CURRENT_VERSION = "2026-10";

/** Produktivbetrieb erst mit abgeschlossenem Auftragsverarbeitungsvertrag (Art. 28 DSGVO). */
export function avvMissing(t: { avvVersion: string | null; avvSignedAt: Date | null }): boolean {
  return !t.avvVersion || !t.avvSignedAt;
}

/**
 * Gesamtexport eines Mandanten (AVV § 10: Rückgabe bei Vertragsende). Enthält alle Inhaltsdaten,
 * aber keine Geheimnisse (Passwort-Hashes, 2FA, Sitzungen, Integrations-Tokens).
 */
export async function exportTenantData(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, slug: true, name: true, industry: true, status: true, timezone: true, settings: true, plan: true,
      monthlyMinuteLimit: true, avvVersion: true, avvSignedAt: true, createdAt: true,
      phoneNumbers: { select: { e164: true, label: true, fallbackNumber: true, createdAt: true } },
      users: { select: { email: true, name: true, role: true, disabled: true, lastLoginAt: true, createdAt: true } },
      employees: true,
      customers: true,
      tickets: true,
      calls: { select: { id: true, fromNumber: true, toNumber: true, customerId: true, status: true, startedAt: true, endedAt: true, durationSec: true, transcript: true, summary: true, endReason: true } },
      messages: { select: { id: true, ticketId: true, channel: true, recipient: true, subject: true, body: true, purpose: true, status: true, createdAt: true } },
      auditLogs: { select: { action: true, target: true, userId: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return tenant ? { exportedAt: new Date().toISOString(), ...tenant } : null;
}

/**
 * Löscht einen Mandanten endgültig (Vertragsende): zuerst alle Anrufe bei Retell/Twilio,
 * danach kaskadierend alle Daten in der Datenbank. Schlägt die Anbieter-Löschung für einzelne
 * Anrufe fehl, wird ohne `force` abgebrochen – bereits gelöschte Anrufe sind markiert, ein
 * erneuter Versuch setzt dort fort.
 */
export async function deleteTenant(tenantId: string, opts: { force?: boolean } = {}): Promise<{ deleted: boolean; providerFailed: number }> {
  const calls = await prisma.call.findMany({
    where: { tenantId, providerPurgedAt: null },
    select: { id: true, provider: true, providerCallId: true, twilioCallSid: true, recordingUrl: true },
  });
  let providerFailed = 0;
  for (const c of calls) {
    const r = await purgeCallAtProviders(c);
    if (r.ok) await prisma.call.update({ where: { id: c.id }, data: { providerPurgedAt: new Date() } });
    else {
      providerFailed++;
      logger.warn("tenant.delete.provider_incomplete", { tenantId, callId: c.id, details: r.details });
    }
  }
  if (providerFailed > 0 && !opts.force) return { deleted: false, providerFailed };
  await prisma.$transaction([
    // Admin-Sitzungen, die gerade in diesen Mandanten gewechselt sind, zurücksetzen
    prisma.session.updateMany({ where: { activeTenantId: tenantId }, data: { activeTenantId: null } }),
    prisma.tenant.delete({ where: { id: tenantId } }), // alle Mandantendaten per Cascade
  ]);
  return { deleted: true, providerFailed };
}
