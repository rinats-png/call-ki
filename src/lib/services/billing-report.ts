import type { BillingSnapshot } from "@prisma/client";
import { prisma } from "../db";
import { costFor, effectivePlan, invoiceFor, usageForMonth, withTopUps, type EffectivePlan, type Invoice, type Usage } from "../billing";
import { zonedParts } from "../time";

export type BillingRow = {
  tenantId: string; tenantName: string; status: string;
  /** true = Monat festgeschrieben (Monatsabschluss) – Werte stammen aus dem BillingSnapshot */
  closed: boolean;
  /** Ausgestellte Rechnung zu diesem Monat */
  invoiceNumber?: string | null;
  plan: EffectivePlan; usage: Usage; invoice: Invoice;
  cost: ReturnType<typeof costFor>; marginCents: number; usagePercent: number | null;
};

/**
 * Abrechnung aller Kunden für einen Monat. Festgeschriebene Monate (Monatsabschluss) kommen aus
 * dem BillingSnapshot – unveränderlich und auch für inzwischen gelöschte Kunden; offene Monate
 * sind eine Vorschau aus Paket und Verbrauch. Es wird keine Rechnung erstellt.
 */
export async function billingReport(year: number, month: number, tenantId?: string): Promise<BillingRow[]> {
  const tenants = await prisma.tenant.findMany({ where: tenantId ? { id: tenantId } : {}, include: { planRef: true }, orderBy: { name: "asc" } });
  const snaps = new Map((await prisma.billingSnapshot.findMany({ where: { year, month, ...(tenantId ? { tenantId } : {}) } })).map((x) => [x.tenantId, x]));
  const rows: BillingRow[] = await Promise.all(
    tenants.map(async (t) => {
      const plan = await withTopUps(t.id, effectivePlan(t, t.planRef), year, month);
      const snap = snaps.get(t.id);
      if (snap && !snap.partial) return fromSnapshot(snap, t.status, plan);
      const usage = await usageForMonth(t, year, month, plan.billingIncrementSec);
      const created = zonedParts(t.createdAt, t.timezone);
      const invoice = invoiceFor(plan, usage, { includeSetupFee: created.year === year && created.month === month });
      return row(t.id, t.name, t.status, false, plan, usage, invoice);
    }),
  );
  // Gelöschte Kunden: nur noch ihr festgeschriebener Monat (Schlussabrechnung) bleibt
  const known = new Set(tenants.map((t) => t.id));
  for (const snap of snaps.values()) if (!known.has(snap.tenantId)) rows.push(fromSnapshot(snap, "DELETED", effectivePlan({ priceOverrideCents: null, includedMinutesOverride: null, overageCentsOverride: null }, null)));
  const numbers = new Map((await prisma.invoice.findMany({ where: { year, month, ...(tenantId ? { tenantId } : {}) }, select: { tenantId: true, number: true } })).map((i) => [i.tenantId, i.number]));
  for (const r of rows) r.invoiceNumber = numbers.get(r.tenantId) ?? null;
  return rows.sort((a, b) => a.tenantName.localeCompare(b.tenantName, "de"));
}

function row(tenantId: string, tenantName: string, status: string, closed: boolean, plan: EffectivePlan, usage: Usage, invoice: Invoice): BillingRow {
  const cost = costFor(usage);
  return {
    tenantId, tenantName, status, closed, plan, usage, invoice, cost,
    marginCents: invoice.netCents - cost.totalCents,
    usagePercent: plan.includedMinutes > 0 ? Math.round((usage.minutes / plan.includedMinutes) * 100) : null,
  };
}

function fromSnapshot(snap: BillingSnapshot, status: string, plan: EffectivePlan): BillingRow {
  return row(snap.tenantId, snap.tenantName, status, true, { ...plan, name: snap.planName }, snap.usage as unknown as Usage, snap.invoice as unknown as Invoice);
}

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function billingCsv(rows: BillingRow[], period: string): string {
  const head = ["Monat", "Kunde", "Status", "Festgeschrieben", "Rechnung", "Paket", "Anrufe", "Minuten", "Inklusive", "Überminuten", "SMS", "Netto €", "USt €", "Brutto €", "Kosten €", "Marge €"];
  const lines = rows.map((r) => [period, r.tenantName, r.status, r.closed ? "ja" : "nein (Vorschau)", r.invoiceNumber ?? "", r.plan.name, r.usage.calls, String(r.usage.minutes).replace(".", ","), r.plan.includedMinutes, r.invoice.overageMinutes, r.usage.sms, eur(r.invoice.netCents), eur(r.invoice.vatCents), eur(r.invoice.grossCents), eur(r.cost.totalCents), eur(r.marginCents)]);
  // Semikolon + BOM: öffnet sich in deutschem Excel korrekt; Formel-Injection verhindern
  const cell = (v: unknown) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [head, ...lines].map((l) => l.map(cell).join(";")).join("\r\n");
}
