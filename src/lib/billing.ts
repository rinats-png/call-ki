import type { Plan, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { setting, settingNumber } from "./platform/config";
import { fromZoned, zonedParts } from "./time";

/**
 * Preise & Verbrauch. Alle Beträge in Cent (netto). Ein Kunde ohne Paket hat keine
 * Preisangaben und alle Funktionen (Altbestand) – das Paket ist optional.
 */
export type EffectivePlan = {
  planId: string | null;
  name: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
  includedMinutes: number;
  overageCentsPerMinute: number;
  overageMode: "CHARGE" | "BLOCK";
  billingIncrementSec: number;
  includedSms: number;
  smsCents: number;
  maxNumbers: number | null;
  maxUsers: number | null;
  features: string[] | null; // null = ohne Paket, keine Einschränkung
};

export function effectivePlan(tenant: Pick<Tenant, "priceOverrideCents" | "includedMinutesOverride" | "overageCentsOverride">, plan: Plan | null): EffectivePlan {
  return {
    planId: plan?.id ?? null,
    name: plan?.name ?? "Ohne Paket",
    monthlyPriceCents: tenant.priceOverrideCents ?? plan?.monthlyPriceCents ?? 0,
    setupFeeCents: plan?.setupFeeCents ?? 0,
    includedMinutes: tenant.includedMinutesOverride ?? plan?.includedMinutes ?? 0,
    overageCentsPerMinute: tenant.overageCentsOverride ?? plan?.overageCentsPerMinute ?? 0,
    overageMode: plan?.overageMode === "BLOCK" ? "BLOCK" : "CHARGE",
    billingIncrementSec: Math.max(1, plan?.billingIncrementSec ?? 60),
    includedSms: plan?.includedSms ?? 0,
    smsCents: plan?.smsCents ?? 0,
    maxNumbers: plan?.maxNumbers ?? null,
    maxUsers: plan?.maxUsers ?? null,
    features: plan ? plan.features : null,
  };
}

export async function planForTenant(tenantId: string) {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { planRef: true } });
  return { tenant: t, plan: effectivePlan(t, t.planRef) };
}

export function hasFeature(plan: EffectivePlan, feature: string): boolean {
  return plan.features === null || plan.features.includes(feature);
}

/** Abrechenbare Minuten: je Gespräch auf den Abrechnungstakt aufgerundet. */
export function billedMinutes(durationsSec: number[], incrementSec: number): number {
  const sec = durationsSec.reduce((sum, d) => sum + Math.ceil(Math.max(0, d) / incrementSec) * incrementSec, 0);
  return Math.round((sec / 60) * 100) / 100;
}

export function monthRange(year: number, month: number, tz: string) {
  const start = fromZoned(year, month, 1, 0, 0, tz);
  const end = month === 12 ? fromZoned(year + 1, 1, 1, 0, 0, tz) : fromZoned(year, month + 1, 1, 0, 0, tz);
  return { start, end };
}

export function currentMonth(tz: string) {
  const p = zonedParts(new Date(), tz);
  return { year: p.year, month: p.month };
}

export type Usage = { calls: number; seconds: number; minutes: number; sms: number; emails: number; tickets: number; emergencies: number };

export async function usageForMonth(tenant: Pick<Tenant, "id" | "timezone">, year: number, month: number, incrementSec: number): Promise<Usage> {
  const { start, end } = monthRange(year, month, tenant.timezone);
  const [calls, sms, emails, tickets, emergencies] = await Promise.all([
    prisma.call.findMany({ where: { tenantId: tenant.id, startedAt: { gte: start, lt: end } }, select: { durationSec: true } }),
    prisma.message.count({ where: { tenantId: tenant.id, channel: "SMS", status: "SENT", createdAt: { gte: start, lt: end } } }),
    prisma.message.count({ where: { tenantId: tenant.id, channel: "EMAIL", status: { in: ["SENT", "DRAFT"] }, createdAt: { gte: start, lt: end } } }),
    prisma.callTicket.count({ where: { tenantId: tenant.id, createdAt: { gte: start, lt: end } } }),
    prisma.callTicket.count({ where: { tenantId: tenant.id, urgency: "CRITICAL", createdAt: { gte: start, lt: end } } }),
  ]);
  const durations = calls.map((c) => c.durationSec ?? 0);
  return {
    calls: calls.length,
    seconds: durations.reduce((a, b) => a + b, 0),
    minutes: billedMinutes(durations.filter((d) => d > 0), incrementSec),
    sms,
    emails,
    tickets,
    emergencies,
  };
}

export type InvoiceLine = { label: string; quantity: number; unit: string; unitCents: number; totalCents: number };
export type Invoice = { lines: InvoiceLine[]; netCents: number; vatPercent: number; vatCents: number; grossCents: number; overageMinutes: number; overageSms: number };

export function vatPercent() {
  return settingNumber("VAT_PERCENT", 19);
}

/** Rechnungsvorschau eines Monats. Die Einrichtungsgebühr fällt im Monat des Vertragsbeginns an. */
export function invoiceFor(plan: EffectivePlan, usage: Usage, opts: { includeSetupFee: boolean }): Invoice {
  const lines: InvoiceLine[] = [];
  if (plan.monthlyPriceCents) lines.push({ label: `Paket ${plan.name} (inkl. ${plan.includedMinutes} Min.)`, quantity: 1, unit: "Monat", unitCents: plan.monthlyPriceCents, totalCents: plan.monthlyPriceCents });
  if (opts.includeSetupFee && plan.setupFeeCents) lines.push({ label: "Einrichtungsgebühr", quantity: 1, unit: "einmalig", unitCents: plan.setupFeeCents, totalCents: plan.setupFeeCents });
  const overageMinutes = Math.max(0, Math.ceil(usage.minutes - plan.includedMinutes));
  if (overageMinutes > 0 && plan.overageMode === "CHARGE") lines.push({ label: "Zusätzliche Gesprächsminuten", quantity: overageMinutes, unit: "Min.", unitCents: plan.overageCentsPerMinute, totalCents: overageMinutes * plan.overageCentsPerMinute });
  const overageSms = Math.max(0, usage.sms - plan.includedSms);
  if (overageSms > 0 && plan.smsCents) lines.push({ label: "Zusätzliche SMS", quantity: overageSms, unit: "SMS", unitCents: plan.smsCents, totalCents: overageSms * plan.smsCents });
  const netCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const vat = vatPercent();
  const vatCents = Math.round((netCents * vat) / 100);
  return { lines, netCents, vatPercent: vat, vatCents, grossCents: netCents + vatCents, overageMinutes, overageSms };
}

/** Eigene Kosten (Einkauf bei Telefonie- und KI-Anbietern) laut Einstellungen – für Marge. */
export function costFor(usage: Usage): { telephonyCents: number; voiceCents: number; smsCents: number; totalCents: number } {
  const minutes = usage.seconds / 60;
  const telephonyCents = Math.round(minutes * settingNumber("COST_TELEPHONY_CENTS_PER_MIN", 1.5));
  const voiceCents = Math.round(minutes * settingNumber("COST_VOICE_CENTS_PER_MIN", 10));
  const smsCents = Math.round(usage.sms * settingNumber("COST_SMS_CENTS", 8));
  return { telephonyCents, voiceCents, smsCents, totalCents: telephonyCents + voiceCents + smsCents };
}

export function costSettingsConfigured(): boolean {
  return !!(setting("COST_TELEPHONY_CENTS_PER_MIN") || setting("COST_VOICE_CENTS_PER_MIN"));
}

/** Tägliche Minuten des Monats (für Verbrauchsgrafiken) */
export async function dailyMinutes(tenant: Pick<Tenant, "id" | "timezone">, year: number, month: number): Promise<{ day: number; minutes: number; calls: number }[]> {
  const { start, end } = monthRange(year, month, tenant.timezone);
  const calls = await prisma.call.findMany({ where: { tenantId: tenant.id, startedAt: { gte: start, lt: end } }, select: { startedAt: true, durationSec: true } });
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, minutes: 0, calls: 0 }));
  for (const c of calls) {
    const d = zonedParts(c.startedAt, tenant.timezone).day;
    out[d - 1].calls++;
    out[d - 1].minutes += Math.round(((c.durationSec ?? 0) / 60) * 10) / 10;
  }
  return out;
}

/** Minuten bis zum Kontingent-Stopp (nur Modus BLOCK) bzw. Kostenbremse monthlyMinuteLimit */
export async function minuteGate(tenant: Tenant & { planRef: Plan | null }): Promise<{ blocked: boolean; reason?: string }> {
  const plan = effectivePlan(tenant, tenant.planRef);
  const needsUsage = tenant.monthlyMinuteLimit != null || (plan.planId && plan.overageMode === "BLOCK");
  if (!needsUsage) return { blocked: false };
  const { year, month } = currentMonth(tenant.timezone);
  const u = await usageForMonth(tenant, year, month, plan.billingIncrementSec);
  if (tenant.monthlyMinuteLimit != null && u.minutes >= tenant.monthlyMinuteLimit) return { blocked: true, reason: "minute_limit" };
  if (plan.planId && plan.overageMode === "BLOCK" && u.minutes >= plan.includedMinutes) return { blocked: true, reason: "plan_quota" };
  return { blocked: false };
}
