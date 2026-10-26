import { prisma } from "../db";
import { HttpError } from "../http";
import { isSlotFree, removeCalendarEvent } from "../calendar";
import { travel, type Leg } from "../geo";
import { formatGermanDateTime, fromZoned, zonedParts } from "../time";
import type { TenantConfig } from "../tenant/settings";
import { notifyForTicket } from "./tickets";
import { locate, originOf } from "./travel";
import type { Tenant } from "@prisma/client";

export type View = "day" | "week" | "month";

/** Zeitraum der Ansicht in der Zeitzone des Betriebs (Woche ab Montag). */
export function rangeFor(view: View, date: string, tz: string): { from: Date; to: Date; days: string[] } {
  const [y, m, d] = date.split("-").map(Number);
  let start = { y, m, d }, n = 1;
  if (view === "week") {
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    const s = new Date(Date.UTC(y, m - 1, d - (wd - 1)));
    start = { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() };
    n = 7;
  } else if (view === "month") {
    start = { y, m, d: 1 };
    n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  const days = Array.from({ length: n }, (_, i) => new Date(Date.UTC(start.y, start.m - 1, start.d + i)).toISOString().slice(0, 10));
  return { from: fromZoned(start.y, start.m, start.d, 0, 0, tz), to: fromZoned(start.y, start.m, start.d + n, 0, 0, tz), days };
}

const dayOf = (d: Date, tz: string) => { const p = zonedParts(d, tz); return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`; };

export type PlanAppointment = {
  ticketId: string; employeeId: string | null; start: string; end: string; day: string;
  category: string | null; service: string | null; urgency: string; status: string; confirmation: string | null; jobStatus: string | null;
  customer: { name: string | null; companyName: string | null; address: string | null; postalCode: string | null; phone: string };
};
export type PlanLeg = { employeeId: string; day: string; fromTicketId: string | null; toTicketId: string | null; minutes: number; km: number; estimated: boolean; tight: boolean };
export type PlanTotals = { employeeId: string; day: string; appointments: number; workMin: number; driveMin: number; km: number };

/** Daten für den Teamkalender: Termine, Fahrten (Tag/Woche), Summen je Person und Tag, ungeplante Vorgänge. */
export async function planningData(tenant: Pick<Tenant, "id" | "timezone">, cfg: TenantConfig, view: View, date: string) {
  const tz = tenant.timezone;
  const { from, to, days } = rangeFor(view, date, tz);
  const [employees, rows, unplanned] = await Promise.all([
    prisma.employee.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true, baseAddress: true, maxTravelMin: true } }),
    prisma.callTicket.findMany({
      where: { tenantId: tenant.id, appointmentStart: { gte: from, lt: to }, appointmentEnd: { not: null } },
      orderBy: { appointmentStart: "asc" },
      take: 1500,
      select: { id: true, assignedEmployeeId: true, appointmentStart: true, appointmentEnd: true, category: true, urgency: true, status: true, confirmation: true, service: { select: { name: true } }, jobReport: { select: { status: true } }, customer: { select: { name: true, companyName: true, address: true, postalCode: true, phone: true } } },
    }),
    prisma.callTicket.findMany({
      where: { tenantId: tenant.id, appointmentStart: null, status: { in: ["PENDING", "ESCALATED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, category: true, urgency: true, createdAt: true, summary: true, assignedEmployeeId: true, service: { select: { durationMin: true, name: true } }, customer: { select: { name: true, companyName: true, postalCode: true, phone: true } } },
    }),
  ]);
  const appointments: PlanAppointment[] = rows.map((r) => ({
    ticketId: r.id, employeeId: r.assignedEmployeeId, start: r.appointmentStart!.toISOString(), end: r.appointmentEnd!.toISOString(), day: dayOf(r.appointmentStart!, tz),
    category: r.category, service: r.service?.name ?? null, urgency: r.urgency, status: r.status, confirmation: r.confirmation, jobStatus: r.jobReport?.status ?? null, customer: r.customer,
  }));

  // Fahrten nur in Tages- und Wochenansicht (Monat: nur Anzahl und Arbeitszeit)
  const legs: PlanLeg[] = [];
  const totals: PlanTotals[] = [];
  for (const e of employees) {
    const origin = view !== "month" ? await originOf(cfg, e) : null;
    for (const day of days) {
      const list = appointments.filter((a) => a.employeeId === e.id && a.day === day);
      if (!list.length) continue;
      const t: PlanTotals = { employeeId: e.id, day, appointments: list.length, workMin: list.reduce((s, a) => s + (Date.parse(a.end) - Date.parse(a.start)) / 60000, 0), driveMin: 0, km: 0 };
      if (view !== "month") {
        const locs = await Promise.all(list.map((a) => locate(a.customer)));
        let prevLoc = origin, prevId: string | null = null, prevEnd: number | null = null;
        for (let i = 0; i < list.length; i++) {
          const loc = locs[i];
          if (prevLoc && loc) {
            const l: Leg = await travel(prevLoc, loc);
            const tight = prevEnd != null && Date.parse(list[i].start) - prevEnd < l.minutes * 60000;
            legs.push({ employeeId: e.id, day, fromTicketId: prevId, toTicketId: list[i].ticketId, ...l, tight });
            t.driveMin += l.minutes; t.km += l.km;
          }
          if (loc) prevLoc = loc;
          prevId = list[i].ticketId;
          prevEnd = Date.parse(list[i].end);
        }
        if (origin && prevLoc && prevLoc !== origin) {
          const back = await travel(prevLoc, origin);
          legs.push({ employeeId: e.id, day, fromTicketId: prevId, toTicketId: null, ...back, tight: false });
          t.driveMin += back.minutes; t.km += back.km;
        }
      }
      t.km = Math.round(t.km * 10) / 10;
      totals.push(t);
    }
  }
  return {
    view, date, days, from: from.toISOString(), to: to.toISOString(), timezone: tz,
    businessHours: cfg.settings.businessHours,
    employees: employees.map(({ id, name, role }) => ({ id, name, role })),
    appointments, legs, totals,
    unplanned: unplanned.map((u) => ({ ticketId: u.id, category: u.category, urgency: u.urgency, createdAt: u.createdAt, summary: (u.summary ?? "").slice(0, 160), employeeId: u.assignedEmployeeId, durationMin: u.service?.durationMin || cfg.durationMin, service: u.service?.name ?? null, customer: u.customer })),
  };
}

/**
 * Termin im Teamkalender verschieben bzw. einplanen (auch auf einen anderen Mitarbeiter):
 * Belegung prüfen, alten Kalendereintrag entfernen, Beteiligte benachrichtigen (Kunde optional).
 */
export async function moveAppointment(tenant: Pick<Tenant, "id" | "name" | "timezone">, cfg: TenantConfig, ticketId: string, opts: { employeeId: string; start: Date; durationMin?: number; notifyCustomer: boolean; userName?: string | null }) {
  const t = await prisma.callTicket.findFirst({ where: { id: ticketId, tenantId: tenant.id }, include: { customer: true, assignedEmployee: true, service: true } });
  if (!t) throw new HttpError(404, "Vorgang nicht gefunden.");
  if (t.status === "CLOSED") throw new HttpError(409, "Abgeschlossene Vorgänge werden nicht mehr verschoben.");
  const employee = await prisma.employee.findFirst({ where: { id: opts.employeeId, tenantId: tenant.id, active: true } });
  if (!employee) throw new HttpError(404, "Mitarbeiter nicht gefunden.");
  if (Number.isNaN(opts.start.getTime()) || opts.start.getTime() < Date.now() - 5 * 60_000) throw new HttpError(400, "Der Termin liegt in der Vergangenheit.");
  const prevMin = t.appointmentStart && t.appointmentEnd ? Math.round((t.appointmentEnd.getTime() - t.appointmentStart.getTime()) / 60000) : 0;
  const minutes = opts.durationMin ?? (prevMin > 0 ? prevMin : t.service?.durationMin || cfg.durationMin);
  const slot = { start: opts.start, end: new Date(opts.start.getTime() + minutes * 60000) };
  if (!(await isSlotFree(tenant.id, cfg, employee, slot, t.id))) throw new HttpError(409, `${employee.name} ist zu dieser Zeit bereits verplant.`);
  if (t.calendarEventId) await removeCalendarEvent(tenant.id, t.assignedEmployee?.email ?? null, t.calendarEventId);
  const note = `${t.appointmentStart ? "Im Teamkalender verschoben" : "Im Teamkalender eingeplant"}: ${formatGermanDateTime(slot.start, tenant.timezone)}, ${employee.name}${opts.userName ? ` (${opts.userName})` : ""}.`;
  const updated = await prisma.callTicket.update({
    where: { id: t.id },
    data: { assignedEmployeeId: employee.id, appointmentStart: slot.start, appointmentEnd: slot.end, calendarEventId: null, reminderSentAt: null, confirmation: null, confirmationAt: null, status: t.status === "PENDING" ? "PROCESSED" : t.status, notes: [t.notes, note].filter(Boolean).join("\n").slice(0, 8000) },
    include: { customer: true, assignedEmployee: true },
  });
  const notify = await notifyForTicket(tenant, cfg, updated, employee, slot, { force: true, skipCustomer: !opts.notifyCustomer });
  return { appointment: slot, notify };
}
