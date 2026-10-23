import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { currentMonth, dailyMinutes, invoiceFor, planForTenant, usageForMonth } from "@/lib/billing";
import { zonedParts } from "@/lib/time";
import { PLAN_FEATURES } from "@/lib/platform/registry";

export const dynamic = "force-dynamic";

/** Tarif & Verbrauch des eigenen Unternehmens (Preise/Rechnungsvorschau nur für Kunden-Admins) */
export const GET = api(async () => {
  const auth = await requireTenant();
  const { tenant, plan } = await planForTenant(auth.tenantId);
  const { year, month } = currentMonth(tenant.timezone);
  const usage = await usageForMonth(tenant, year, month, plan.billingIncrementSec);
  const daily = await dailyMinutes(tenant, year, month);
  const history = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(year, month - 1 - (5 - i), 1));
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
      return usageForMonth(tenant, y, m, plan.billingIncrementSec).then((u) => ({ period: `${y}-${String(m).padStart(2, "0")}`, minutes: u.minutes, calls: u.calls }));
    }),
  );
  const today = zonedParts(new Date(), tenant.timezone).day;
  const daysInMonth = daily.length;
  // Hochrechnung bis Monatsende (linear nach bisherigem Verbrauch)
  const projected = today > 0 ? Math.round((usage.minutes / today) * daysInMonth) : usage.minutes;
  const isAdmin = auth.isPlatformAdmin || auth.user.role === "TENANT_ADMIN";
  const created = zonedParts(tenant.createdAt, tenant.timezone);
  return NextResponse.json({
    plan: {
      name: plan.name,
      hasPlan: !!plan.planId,
      includedMinutes: plan.includedMinutes,
      overageMode: plan.overageMode,
      includedSms: plan.includedSms,
      features: (plan.features ?? PLAN_FEATURES.map((f) => f.key)).map((k) => PLAN_FEATURES.find((f) => f.key === k)?.label ?? k),
      ...(isAdmin ? { monthlyPriceCents: plan.monthlyPriceCents, overageCentsPerMinute: plan.overageCentsPerMinute, smsCents: plan.smsCents } : {}),
    },
    usage,
    projectedMinutes: projected,
    daily,
    history,
    invoice: isAdmin ? invoiceFor(plan, usage, { includeSetupFee: created.year === year && created.month === month }) : null,
  });
});
