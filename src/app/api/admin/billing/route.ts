import { NextResponse } from "next/server";
import { api, badRequest } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { billingCsv, billingReport } from "@/lib/services/billing-report";
import { costSettingsConfigured, currentMonth, vatPercent } from "@/lib/billing";
import { setting } from "@/lib/platform/config";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Abrechnungsvorschau aller Kunden (?month=2026-10, &format=csv) */
export const GET = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const url = new URL(req.url);
  const m = url.searchParams.get("month") ?? "";
  const cur = currentMonth("Europe/Berlin");
  const [year, month] = m ? m.split("-").map(Number) : [cur.year, cur.month];
  if (!year || !month || month < 1 || month > 12) throw badRequest("Monat im Format JJJJ-MM angeben");
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const rows = await billingReport(year, month);
  if (url.searchParams.get("format") === "csv") {
    await audit({ userId: auth.user.id, action: "billing.export", target: period });
    return new Response(billingCsv(rows, period), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="abrechnung-${period}.csv"` } });
  }
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return NextResponse.json({
    period,
    rows,
    totals: { netCents: sum((r) => r.invoice.netCents), grossCents: sum((r) => r.invoice.grossCents), costCents: sum((r) => r.cost.totalCents), marginCents: sum((r) => r.marginCents), minutes: sum((r) => r.usage.minutes), calls: sum((r) => r.usage.calls) },
    costs: {
      configured: costSettingsConfigured(),
      telephony: setting("COST_TELEPHONY_CENTS_PER_MIN") ?? "",
      voice: setting("COST_VOICE_CENTS_PER_MIN") ?? "",
      sms: setting("COST_SMS_CENTS") ?? "",
      vat: String(vatPercent()),
    },
  });
});
