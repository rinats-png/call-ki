import type { Employee } from "@prisma/client";
import { prisma } from "../db";
import { hasModule } from "../addons";
import { customerAddress, geocode, travel, type LatLon, type Leg } from "../geo";
import { fromZoned, zonedParts, type Interval } from "../time";
import type { TenantConfig } from "../tenant/settings";

/** Fahrzeiten nur mit gebuchter Einsatzplanung und eingeschalteter Option. */
export async function travelEnabled(tenantId: string, cfg: TenantConfig): Promise<boolean> {
  return cfg.settings.planning.travelAware && (await hasModule(tenantId, "planning"));
}

/** Startpunkt eines Mitarbeiters: eigene Adresse, sonst Betriebsadresse. */
export async function originOf(cfg: TenantConfig, employee: { baseAddress?: string | null }): Promise<LatLon | null> {
  return geocode(employee.baseAddress?.trim() || cfg.settings.planning.depotAddress || null);
}

/** Zielort eines Kunden (Adresse bzw. PLZ). */
export async function locate(c: { address?: string | null; postalCode?: string | null } | null | undefined): Promise<LatLon | null> {
  return c ? geocode(customerAddress(c)) : null;
}

const ADJ = 90 * 60000;
type Stop = { start: Date; end: Date; loc: LatLon | null };
export type TravelSlot = Interval & { travelMin: number | null; detourMin: number | null; nearby: boolean };

const sameDay = (a: Date, b: Date, tz: string) => { const x = zonedParts(a, tz), y = zonedParts(b, tz); return x.year === y.year && x.month === y.month && x.day === y.day; };
function dayStart(d: Date, tz: string, hhmm: string): Date {
  const p = zonedParts(d, tz);
  const [h, m] = hhmm.split(":").map(Number);
  return fromZoned(p.year, p.month, p.day, h, m, tz);
}

/**
 * Prüft Kandidaten-Slots gegen die Fahrzeit vom vorherigen und zum nächsten Termin desselben Tages
 * (erster Termin des Tages: ab Startpunkt zu Arbeitsbeginn) und berechnet den Umweg.
 */
export async function filterByTravel(opts: { candidates: Interval[]; stops: Stop[]; origin: LatLon | null; target: LatLon; tz: string; workStart: string; leg?: (a: LatLon, b: LatLon) => Promise<Leg> }): Promise<TravelSlot[]> {
  const leg = opts.leg ?? travel;
  const out: TravelSlot[] = [];
  const stops = [...opts.stops].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const s of opts.candidates) {
    const day = stops.filter((x) => sameDay(x.start, s.start, opts.tz));
    const prev = [...day].reverse().find((x) => x.end <= s.start);
    const next = day.find((x) => x.start >= s.end);
    const prevLoc = prev ? prev.loc : opts.origin;
    const prevEnd = prev ? prev.end : dayStart(s.start, opts.tz, opts.workStart);
    const toHere = prevLoc ? (await leg(prevLoc, opts.target)).minutes : null;
    if (toHere != null && s.start.getTime() - prevEnd.getTime() < toHere * 60000) continue;
    const toNext = next?.loc ? (await leg(opts.target, next.loc)).minutes : null;
    if (toNext != null && next && next.start.getTime() - s.end.getTime() < toNext * 60000) continue;
    // „In der Nähe“ zählt nur, wenn der Nachbartermin zeitlich anschließt (≤ 90 Min. Lücke)
    const prevAdj = !!prev?.loc && toHere != null && s.start.getTime() - prev.end.getTime() <= ADJ;
    const nextAdj = !!next?.loc && toNext != null && next.start.getTime() - s.end.getTime() <= ADJ;
    let detour: number | null = null;
    if (prevAdj && nextAdj) detour = toHere! + toNext! - (await leg(prev!.loc!, next!.loc!)).minutes;
    else if (prevAdj) detour = toHere;
    else if (nextAdj) detour = toNext;
    out.push({ ...s, travelMin: toHere, detourMin: detour, nearby: prevAdj || nextAdj });
  }
  return out;
}

/** Auswahl: bei „Bündeln“ zuerst Slots mit kleinem Umweg neben bestehenden Terminen, dann chronologisch; Abstand ≥ 60 Min. */
export function pickSlots(slots: TravelSlot[], opts: { max: number; bundle: boolean; maxDetourMin: number; spreadMin?: number }): TravelSlot[] {
  const near = (s: TravelSlot) => opts.bundle && s.nearby && s.detourMin != null && s.detourMin <= opts.maxDetourMin;
  const sorted = [...slots].sort((a, b) => Number(near(b)) - Number(near(a)) || a.start.getTime() - b.start.getTime());
  const spread = (opts.spreadMin ?? 60) * 60000;
  const picked: TravelSlot[] = [];
  for (const s of sorted) {
    if (picked.length >= opts.max) break;
    if (picked.some((p) => Math.abs(p.start.getTime() - s.start.getTime()) < spread)) continue;
    picked.push(s);
  }
  return picked.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Termine des Mitarbeiters im Zeitraum mit Ort (für Fahrzeiten und Teamkalender). */
export async function stopsOf(tenantId: string, employeeId: string, from: Date, to: Date, excludeTicketId?: string): Promise<Stop[]> {
  const rows = await prisma.callTicket.findMany({
    where: { tenantId, assignedEmployeeId: employeeId, appointmentStart: { lt: to }, appointmentEnd: { gt: from }, status: { not: "CLOSED" }, ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}) },
    select: { appointmentStart: true, appointmentEnd: true, customer: { select: { address: true, postalCode: true } } },
    orderBy: { appointmentStart: "asc" },
  });
  return Promise.all(rows.map(async (r) => ({ start: r.appointmentStart!, end: r.appointmentEnd!, loc: await locate(r.customer) })));
}

/** Anfahrtszuschlag laut Einstellungen (null = keiner). */
export async function travelFeeFor(tenantId: string, cfg: TenantConfig, employee: { baseAddress?: string | null } | null, target: LatLon | null): Promise<{ cents: number; minutes: number } | null> {
  const p = cfg.settings.planning;
  if (!p.travelFeeCents || !target || !(await hasModule(tenantId, "planning"))) return null;
  const origin = await originOf(cfg, { baseAddress: employee?.baseAddress ?? null });
  if (!origin) return null;
  const { minutes } = await travel(origin, target);
  return minutes >= p.travelFeeFromMin ? { cents: p.travelFeeCents, minutes } : null;
}
