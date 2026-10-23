import { prisma } from "../db";
import { costFor, effectivePlan, invoiceFor, usageForMonth, type EffectivePlan, type Invoice, type Usage } from "../billing";
import { zonedParts } from "../time";

export type BillingRow = {
  tenantId: string; tenantName: string; status: string;
  plan: EffectivePlan; usage: Usage; invoice: Invoice;
  cost: ReturnType<typeof costFor>; marginCents: number; usagePercent: number | null;
};

/** Abrechnung aller Kunden für einen Monat (Vorschau – keine Rechnungsstellung). */
export async function billingReport(year: number, month: number, tenantId?: string): Promise<BillingRow[]> {
  const tenants = await prisma.tenant.findMany({ where: tenantId ? { id: tenantId } : {}, include: { planRef: true }, orderBy: { name: "asc" } });
  return Promise.all(
    tenants.map(async (t) => {
      const plan = effectivePlan(t, t.planRef);
      const usage = await usageForMonth(t, year, month, plan.billingIncrementSec);
      const created = zonedParts(t.createdAt, t.timezone);
      const invoice = invoiceFor(plan, usage, { includeSetupFee: created.year === year && created.month === month });
      const cost = costFor(usage);
      return {
        tenantId: t.id, tenantName: t.name, status: t.status, plan, usage, invoice, cost,
        marginCents: invoice.netCents - cost.totalCents,
        usagePercent: plan.includedMinutes > 0 ? Math.round((usage.minutes / plan.includedMinutes) * 100) : null,
      };
    }),
  );
}

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function billingCsv(rows: BillingRow[], period: string): string {
  const head = ["Monat", "Kunde", "Status", "Paket", "Anrufe", "Minuten", "Inklusive", "Überminuten", "SMS", "Netto €", "USt €", "Brutto €", "Kosten €", "Marge €"];
  const lines = rows.map((r) => [period, r.tenantName, r.status, r.plan.name, r.usage.calls, String(r.usage.minutes).replace(".", ","), r.plan.includedMinutes, r.invoice.overageMinutes, r.usage.sms, eur(r.invoice.netCents), eur(r.invoice.vatCents), eur(r.invoice.grossCents), eur(r.cost.totalCents), eur(r.marginCents)]);
  // Semikolon + BOM: öffnet sich in deutschem Excel korrekt; Formel-Injection verhindern
  const cell = (v: unknown) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [head, ...lines].map((l) => l.map(cell).join(";")).join("\r\n");
}
