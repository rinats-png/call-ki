import type { Employee, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { microsoftConfigured } from "./env";
import { getBusyIntervals } from "./graph";
import { googleBusy, googleLinked } from "./google";
import { logger } from "./logger";
import { computeFreeSlots, overlaps, type Interval } from "./time";
import type { TenantConfig } from "./tenant/settings";

/**
 * Kalender je Mandant:
 *  - Intern (immer aktiv): Termine aus den Tickets – funktioniert für jeden Kunden.
 *  - Microsoft 365 (optional): zusätzliche Belegung aus dem Outlook-Kalender des Mitarbeiters.
 *  - Google Kalender (optional): Belegung aus dem Google-Kalender des Mitarbeiters (Kalender-ID = E-Mail).
 */
export type MicrosoftLink = { msTenantId: string; draftMailbox: string | null };

export async function getMicrosoftLink(tenantId: string): Promise<MicrosoftLink | null> {
  if (!microsoftConfigured()) return null;
  const integ = await prisma.integration.findUnique({ where: { tenantId_type: { tenantId, type: "MICROSOFT_365" } } });
  if (!integ || integ.status !== "CONNECTED") return null;
  const cfg = integ.config as { msTenantId?: string; draftMailbox?: string };
  return cfg.msTenantId ? { msTenantId: cfg.msTenantId, draftMailbox: cfg.draftMailbox || null } : null;
}

async function internalBusy(tenantId: string, employeeId: string, from: Date, to: Date, excludeTicketId?: string): Promise<Interval[]> {
  const rows = await prisma.callTicket.findMany({
    where: {
      tenantId,
      assignedEmployeeId: employeeId,
      appointmentStart: { lt: to },
      appointmentEnd: { gt: from },
      ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
    },
    select: { appointmentStart: true, appointmentEnd: true },
  });
  return rows.map((r) => ({ start: r.appointmentStart!, end: r.appointmentEnd! }));
}

async function busyFromProviders(tenantId: string, employee: Pick<Employee, "email">, from: Date, to: Date): Promise<{ busy: Interval[]; error: string | null }> {
  const ms = employee.email ? await getMicrosoftLink(tenantId) : null;
  if (!ms) {
    if (!employee.email || !(await googleLinked(tenantId))) return { busy: [], error: null };
    try {
      return { busy: await googleBusy(tenantId, employee.email, from, to), error: null };
    } catch (err) {
      logger.error("calendar.google_busy_failed", { tenantId, error: (err as Error).message });
      return { busy: [], error: "Google-Kalender nicht erreichbar" };
    }
  }
  try {
    return { busy: await getBusyIntervals(ms.msTenantId, employee.email!, from, to), error: null };
  } catch (err) {
    logger.error("calendar.ms_busy_failed", { tenantId, error: (err as Error).message });
    return { busy: [], error: "Outlook-Kalender nicht erreichbar" };
  }
}

export async function findAvailableSlots(
  tenant: Pick<Tenant, "id" | "timezone">,
  cfg: TenantConfig,
  employee: Pick<Employee, "id" | "email">,
  opts: { urgent?: boolean; from?: Date } = {},
): Promise<{ slots: Interval[]; calendarError: string | null }> {
  const a = cfg.settings.appointments;
  const from = opts.from ?? new Date();
  const to = new Date(from.getTime() + (a.daysAhead + 1) * 86400000);
  const [internal, ext] = await Promise.all([internalBusy(tenant.id, employee.id, from, to), busyFromProviders(tenant.id, employee, from, to)]);
  const bh = cfg.settings.businessHours;
  const slots = computeFreeSlots({
    from,
    days: a.daysAhead,
    busy: [...internal, ...ext.busy],
    durationMin: cfg.durationMin,
    timeZone: tenant.timezone,
    workDays: bh.days,
    start: bh.start,
    end: bh.end,
    bufferMin: a.bufferMin,
    max: a.slotsOffered,
    leadMinutes: opts.urgent ? Math.min(a.leadMin, 60) : a.leadMin,
  });
  return { slots, calendarError: ext.error };
}

/** Prüft unmittelbar vor der Buchung erneut, ob der Slot frei ist (zwei Anrufer, gleicher Slot). */
export async function isSlotFree(tenantId: string, cfg: TenantConfig, employee: Pick<Employee, "id" | "email">, slot: Interval, excludeTicketId?: string): Promise<boolean> {
  const buffer = cfg.settings.appointments.bufferMin * 60000;
  const from = new Date(slot.start.getTime() - buffer);
  const to = new Date(slot.end.getTime() + buffer);
  const [internal, ext] = await Promise.all([internalBusy(tenantId, employee.id, from, to, excludeTicketId), busyFromProviders(tenantId, employee, from, to)]);
  const padded = { start: from, end: to };
  return ![...internal, ...ext.busy].some((b) => overlaps(b, padded));
}
