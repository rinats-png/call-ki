import type { Tenant } from "@prisma/client";
import { prisma } from "../db";
import { travel } from "../geo";
import { fromZoned } from "../time";
import type { TenantConfig } from "../tenant/settings";
import { locate, originOf } from "./travel";

/**
 * „Mein Tag“: Termine der Person (Mitarbeiter mit derselben E-Mail wie das Benutzerkonto),
 * offene Rückrufe (Vorgänge ohne Termin) und Aufgaben. Ohne verknüpften Mitarbeiter: Termine des ganzen Teams.
 */
export async function myDay(tenant: Pick<Tenant, "id" | "timezone">, cfg: TenantConfig, user: { id: string; email: string }, date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const from = fromZoned(y, m, d, 0, 0, tenant.timezone), to = fromZoned(y, m, d + 1, 0, 0, tenant.timezone);
  const employee = await prisma.employee.findFirst({ where: { tenantId: tenant.id, active: true, email: { equals: user.email, mode: "insensitive" } }, select: { id: true, name: true, baseAddress: true } });
  const [appointments, callbacks, tasks] = await Promise.all([
    prisma.callTicket.findMany({
      where: { tenantId: tenant.id, appointmentStart: { gte: from, lt: to }, ...(employee ? { assignedEmployeeId: employee.id } : {}) },
      orderBy: { appointmentStart: "asc" },
      take: 100,
      select: { id: true, appointmentStart: true, appointmentEnd: true, category: true, urgency: true, status: true, summary: true, confirmation: true, assignedEmployee: { select: { name: true } }, service: { select: { name: true } }, customer: { select: { name: true, companyName: true, phone: true, address: true, postalCode: true } } },
    }),
    prisma.callTicket.findMany({
      where: { tenantId: tenant.id, appointmentStart: null, status: { in: ["PENDING", "ESCALATED"] }, ...(employee ? { OR: [{ assignedEmployeeId: employee.id }, { assignedEmployeeId: null }] } : {}) },
      orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      take: 50,
      select: { id: true, category: true, urgency: true, status: true, summary: true, createdAt: true, assignedEmployee: { select: { name: true } }, customer: { select: { name: true, companyName: true, phone: true } } },
    }),
    prisma.task.findMany({
      where: { tenantId: tenant.id, OR: [{ assigneeId: user.id }, { assigneeId: null }], AND: [{ OR: [{ doneAt: null }, { doneAt: { gte: from } }] }, { OR: [{ dueAt: null }, { dueAt: { lt: to } }] }] },
      orderBy: [{ doneAt: { sort: "asc", nulls: "first" } }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 100,
      select: { id: true, title: true, note: true, dueAt: true, doneAt: true, assigneeId: true, ticketId: true, assignee: { select: { name: true, email: true } } },
    }),
  ]);
  // Fahrzeiten zwischen den eigenen Terminen (nur mit verknüpftem Mitarbeiter)
  const legs: Record<string, { minutes: number; km: number }> = {};
  if (employee) {
    let prev = await originOf(cfg, employee);
    for (const a of appointments) {
      const loc = await locate(a.customer);
      if (prev && loc) legs[a.id] = await travel(prev, loc);
      if (loc) prev = loc;
    }
  }
  return { date, employee: employee ? { id: employee.id, name: employee.name } : null, appointments, legs, callbacks, tasks };
}
