import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env, graphConfigured } from "@/lib/env";
import { TIMEZONE } from "@/lib/constants";
import { fromZoned, zonedParts } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const urgency = url.searchParams.get("urgency");
  const q = url.searchParams.get("q")?.trim();

  const now = new Date();
  const p = zonedParts(now, TIMEZONE);
  const startOfDay = fromZoned(p.year, p.month, p.day, 0, 0, TIMEZONE);
  const since7 = new Date(startOfDay.getTime() - 6 * 86400000);

  const where: Prisma.CallTicketWhereInput = {
    ...(status ? { status } : {}),
    ...(urgency ? { urgency } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q } },
            { pestType: { contains: q } },
            { customer: { name: { contains: q } } },
            { customer: { companyName: { contains: q } } },
            { customer: { phone: { contains: q } } },
            { customer: { postalCode: { startsWith: q } } },
          ],
        }
      : {}),
  };

  const [tickets, todayCount, escalatedOpen, pendingCount, processedToday, synced, newCustomersToday, week, employees, totalCustomers] =
    await Promise.all([
      prisma.callTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, pestType: true, urgency: true, summary: true, status: true, createdAt: true,
          outlookEventId: true, outlookDraftId: true,
          customer: { select: { id: true, name: true, companyName: true, phone: true, postalCode: true, customerType: true, status: true } },
          assignedEmployee: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.callTicket.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.callTicket.count({ where: { status: "ESCALATED" } }),
      prisma.callTicket.count({ where: { status: "PENDING" } }),
      prisma.callTicket.count({ where: { createdAt: { gte: startOfDay }, status: "PROCESSED" } }),
      prisma.callTicket.count({ where: { createdAt: { gte: startOfDay }, OR: [{ outlookEventId: { not: null } }, { outlookDraftId: { not: null } }] } }),
      prisma.customer.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.callTicket.findMany({ where: { createdAt: { gte: since7 } }, select: { createdAt: true, urgency: true } }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tickets: { where: { status: { in: ["PENDING", "ESCALATED"] } } } } } },
      }),
      prisma.customer.count(),
    ]);

  // 7-Tage-Verlauf
  const days: { date: string; total: number; critical: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(since7.getTime() + i * 86400000);
    const dp = zonedParts(d, TIMEZONE);
    days.push({ date: `${dp.year}-${String(dp.month).padStart(2, "0")}-${String(dp.day).padStart(2, "0")}`, total: 0, critical: 0 });
  }
  for (const t of week) {
    const dp = zonedParts(t.createdAt, TIMEZONE);
    const key = `${dp.year}-${String(dp.month).padStart(2, "0")}-${String(dp.day).padStart(2, "0")}`;
    const day = days.find((x) => x.date === key);
    if (day) {
      day.total++;
      if (t.urgency === "CRITICAL" || t.urgency === "HIGH") day.critical++;
    }
  }

  return NextResponse.json({
    stats: {
      todayCount,
      escalatedOpen,
      pendingCount,
      processedToday,
      outlookSyncedToday: synced,
      newCustomersToday,
      totalCustomers,
      automationRate: todayCount ? Math.round((processedToday / todayCount) * 100) : null,
    },
    week: days,
    tickets,
    employees: employees.map(({ _count, ...e }) => ({ ...e, openTickets: _count.tickets })),
    integrations: {
      voiceProvider: env().VOICE_PROVIDER,
      voiceConfigured: env().VOICE_PROVIDER === "retell" ? !!(env().RETELL_API_KEY && env().RETELL_AGENT_ID) : !!env().VOICE_TOOL_SECRET,
      twilioConfigured: !!env().TWILIO_AUTH_TOKEN,
      graphConfigured: graphConfigured(),
    },
    serverTime: now.toISOString(),
  });
}
