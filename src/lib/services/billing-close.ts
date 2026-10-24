import { prisma } from "../db";
import { logger } from "../logger";
import { effectivePlan, invoiceFor, liveUsageForMonth, monthRange, withTopUps } from "../billing";
import { zonedParts } from "../time";

/**
 * Monatsabschluss (docs/recht/loeschkonzept.md §5, R1/R2/R4–R6): Summen je Kunde und Monat
 * werden festgeschrieben, bevor Anrufdaten gelöscht werden dürfen. Danach liefert
 * usageForMonth für diesen Monat die festgeschriebenen Werte.
 */
export async function closeMonth(tenantId: string, year: number, month: number, opts: { partial?: boolean } = {}) {
  const existing = await prisma.billingSnapshot.findUnique({ where: { tenantId_year_month: { tenantId, year, month } } });
  if (existing && !existing.partial) return existing;
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { planRef: true } });
  const plan = await withTopUps(t.id, effectivePlan(t, t.planRef), year, month);
  const usage = await liveUsageForMonth(t, year, month, plan.billingIncrementSec);
  const created = zonedParts(t.createdAt, t.timezone);
  const invoice = invoiceFor(plan, usage, { includeSetupFee: created.year === year && created.month === month });
  const data = { tenantName: t.name, planName: plan.name, usage, invoice, partial: !!opts.partial, closedAt: new Date() };
  return prisma.billingSnapshot.upsert({ where: { tenantId_year_month: { tenantId, year, month } }, create: { tenantId, year, month, ...data }, update: data });
}

/** Alle abgelaufenen Monate eines Kunden abschließen (ab dem 3. des Folgemonats – Nachzügler-Ereignisse). */
export async function closeDueMonths(tenantId: string, now = new Date()) {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { createdAt: true, timezone: true } });
  const today = zonedParts(now, t.timezone);
  const oldestCall = await prisma.call.findFirst({ where: { tenantId }, orderBy: { startedAt: "asc" }, select: { startedAt: true } });
  const from = zonedParts(oldestCall && oldestCall.startedAt < t.createdAt ? oldestCall.startedAt : t.createdAt, t.timezone);
  let y = from.year, m = from.month, closed = 0;
  // letzter abschließbarer Monat: Vormonat, sobald der 3. erreicht ist
  const last = today.day >= 3 ? { y: today.month === 1 ? today.year - 1 : today.year, m: today.month === 1 ? 12 : today.month - 1 } : { y: today.month <= 2 ? today.year - 1 : today.year, m: ((today.month + 9) % 12) + 1 };
  while (y < last.y || (y === last.y && m <= last.m)) {
    const snap = await prisma.billingSnapshot.findUnique({ where: { tenantId_year_month: { tenantId, year: y, month: m } }, select: { partial: true } });
    if (!snap || snap.partial) {
      await closeMonth(tenantId, y, m);
      closed++;
    }
    if (++m > 12) { m = 1; y++; }
  }
  if (closed) logger.info("billing.months_closed", { tenantId, closed });
  return { closed, lastClosed: last };
}

/** Beginn des ersten noch nicht abgeschlossenen Monats – ältere Anrufe dürfen gelöscht werden (R4). */
export async function openPeriodStart(tenantId: string, timezone: string, now = new Date()): Promise<Date> {
  const latest = await prisma.billingSnapshot.findFirst({ where: { tenantId, partial: false }, orderBy: [{ year: "desc" }, { month: "desc" }], select: { year: true, month: true } });
  if (!latest) return new Date(0);
  const next = latest.month === 12 ? { y: latest.year + 1, m: 1 } : { y: latest.year, m: latest.month + 1 };
  const start = monthRange(next.y, next.m, timezone).start;
  return start < now ? start : now;
}
