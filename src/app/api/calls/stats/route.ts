import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { currentMonth, monthRange } from "@/lib/billing";

export const dynamic = "force-dynamic";

/** Kennzahlen der Anrufe im laufenden Monat (Zeitzone des Mandanten) – Grundlage für das Band auf der Anrufe-Seite. */
export const GET = api(async () => {
  const auth = await requireTenant();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { timezone: true } });
  const { year, month } = currentMonth(tenant.timezone);
  const { start, end } = monthRange(year, month, tenant.timezone);
  const inMonth = { tenantId: auth.tenantId, startedAt: { gte: start, lt: end } };
  const [calls, talked, withTicket, live] = await Promise.all([
    prisma.call.count({ where: inMonth }),
    prisma.call.aggregate({ where: { ...inMonth, durationSec: { gt: 0 } }, _sum: { durationSec: true }, _avg: { durationSec: true }, _count: true }),
    prisma.call.count({ where: { ...inMonth, tickets: { some: {} } } }),
    // „live“ nur für frische Anrufe – hängengebliebene Status älter als 2 h zählen nicht
    prisma.call.count({ where: { tenantId: auth.tenantId, status: { in: ["RINGING", "IN_PROGRESS"] }, startedAt: { gte: new Date(Date.now() - 2 * 3600_000) } } }),
  ]);
  const seconds = talked._sum.durationSec ?? 0;
  return NextResponse.json({
    period: `${year}-${String(month).padStart(2, "0")}`,
    calls,
    minutes: Math.round((seconds / 60) * 10) / 10,
    avgDurationSec: talked._avg.durationSec == null ? null : Math.round(talked._avg.durationSec),
    withTicketPercent: calls ? Math.round((withTicket / calls) * 100) : null,
    live,
  });
});
