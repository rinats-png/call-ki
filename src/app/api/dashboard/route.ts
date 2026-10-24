import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { loadTenant } from "@/lib/tenant";
import { getMicrosoftLink } from "@/lib/calendar";
import { fromZoned, zonedParts } from "@/lib/time";
import { minutesThisMonth } from "@/lib/voice/context";
import { retellConfigured, smsConfigured, smtpConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

const dayKey = (d: Date, tz: string) => {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

export const GET = api(async (req) => {
  const auth = await requireTenant();
  const { tenant } = await loadTenant(auth.tenantId);
  const tenantId = tenant.id;
  const tz = tenant.timezone;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim();

  const p = zonedParts(new Date(), tz);
  const startOfDay = fromZoned(p.year, p.month, p.day, 0, 0, tz);
  // Kalendertage in Ortszeit (bei Zeitumstellung hat ein Tag 23 oder 25 Stunden)
  const since7 = fromZoned(p.year, p.month, p.day - 6, 0, 0, tz);

  const where: Prisma.CallTicketWhereInput = {
    tenantId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { companyName: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
            { customer: { postalCode: { startsWith: q } } },
          ],
        }
      : {}),
  };

  const [tickets, todayCount, escalatedOpen, pendingCount, plannedToday, callsToday, newCustomersToday, week, employees, totalCustomers, minutes, ms, numbers] = await Promise.all([
    prisma.callTicket.findMany({
      where, orderBy: { createdAt: "desc" }, take: 100,
      select: {
        id: true, category: true, urgency: true, summary: true, status: true, createdAt: true, appointmentStart: true, calendarEventId: true,
        customer: { select: { id: true, name: true, companyName: true, phone: true, postalCode: true, customerType: true, status: true } },
        assignedEmployee: { select: { id: true, name: true, role: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.callTicket.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.callTicket.count({ where: { tenantId, status: "ESCALATED" } }),
    prisma.callTicket.count({ where: { tenantId, status: "PENDING" } }),
    prisma.callTicket.count({ where: { tenantId, createdAt: { gte: startOfDay }, appointmentStart: { not: null } } }),
    prisma.call.count({ where: { tenantId, startedAt: { gte: startOfDay } } }),
    prisma.customer.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.call.findMany({ where: { tenantId, startedAt: { gte: since7 } }, select: { startedAt: true, tickets: { select: { urgency: true } } } }),
    prisma.employee.findMany({
      where: { tenantId, active: true }, orderBy: { name: "asc" },
      include: { _count: { select: { tickets: { where: { status: { in: ["PENDING", "ESCALATED"] } } } } } },
    }),
    prisma.customer.count({ where: { tenantId } }),
    minutesThisMonth(tenant),
    getMicrosoftLink(tenantId),
    prisma.phoneNumber.count({ where: { tenantId } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => ({ date: dayKey(new Date(since7.getTime() + i * 86400000 + 12 * 3600000), tz), total: 0, critical: 0 }));
  for (const c of week) {
    const d = days.find((x) => x.date === dayKey(c.startedAt, tz));
    if (!d) continue;
    d.total++;
    if (c.tickets.some((t) => t.urgency === "CRITICAL" || t.urgency === "HIGH")) d.critical++;
  }

  return NextResponse.json({
    stats: {
      callsToday, todayCount, escalatedOpen, pendingCount, plannedToday, newCustomersToday, totalCustomers,
      minutesThisMonth: minutes, minuteLimit: tenant.monthlyMinuteLimit,
      automationRate: todayCount ? Math.round((plannedToday / todayCount) * 100) : null,
    },
    week: days,
    tickets: tickets.map(({ _count, ...t }) => ({ ...t, messageCount: _count.messages })),
    employees: employees.map(({ _count, ...e }) => ({ ...e, openTickets: _count.tickets })),
    integrations: { phone: numbers > 0, voice: retellConfigured(), outlook: !!ms, email: smtpConfigured(), sms: smsConfigured() },
    serverTime: new Date().toISOString(),
  });
});
