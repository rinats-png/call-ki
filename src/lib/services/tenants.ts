import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getTemplate } from "../tenant/templates";
import { slugify } from "../tenant";
import { fromZoned, zonedParts } from "../time";
import { sendInviteEmail } from "./users";

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
