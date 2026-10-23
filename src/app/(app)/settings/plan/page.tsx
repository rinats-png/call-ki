"use client";

import { CheckCircle2 } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, eur } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { InfoTip } from "@/components/InfoTip";
import { UsageBar } from "@/components/UsageBar";
import { AreaChart } from "@/components/AreaChart";
import { BarChart } from "@/components/BarChart";

type Data = {
  plan: { name: string; hasPlan: boolean; includedMinutes: number; overageMode: string; includedSms: number; features: string[]; monthlyPriceCents?: number; overageCentsPerMinute?: number; smsCents?: number };
  usage: { calls: number; minutes: number; sms: number; emails: number; tickets: number; emergencies: number };
  projectedMinutes: number;
  daily: { day: number; minutes: number; calls: number }[];
  history: { period: string; minutes: number; calls: number }[];
  invoice: { lines: { label: string; quantity: number; totalCents: number }[]; netCents: number; vatPercent: number; vatCents: number; grossCents: number } | null;
};

const monthName = (p: string) => new Date(`${p}-01T12:00:00`).toLocaleDateString("de-DE", { month: "short" });

export default function Page() {
  const { data } = usePoll<Data>("/api/billing", 60_000);
  if (!data) return <Skeleton className="h-96" />;
  const { plan, usage } = data;
  const willExceed = plan.includedMinutes > 0 && data.projectedMinutes > plan.includedMinutes;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={<span className="flex items-center gap-1">Ihr Paket<InfoTip title="Ihr Paket" steps={["Freiminuten gelten je Kalendermonat und verfallen am Monatsende.", plan.overageMode === "BLOCK" ? "Sind die Freiminuten aufgebraucht, nimmt die KI keine Anrufe mehr an – sie gehen an Ihre Ausweichnummer bzw. Mailbox." : "Darüber hinaus wird jede weitere Minute zum vereinbarten Preis berechnet.", "Für ein anderes Paket wenden Sie sich an Ihren Ansprechpartner."]} /></span>}>
          <div className="text-xl font-semibold text-zinc-50">{plan.name}</div>
          {plan.monthlyPriceCents != null && plan.hasPlan && <div className="text-sm text-zinc-400">{eur(plan.monthlyPriceCents)} netto / Monat · {plan.overageMode === "BLOCK" ? "Stopp nach Kontingent" : `${eur(plan.overageCentsPerMinute)} je weitere Minute`}</div>}
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
            {plan.features.map((f) => <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{f}</li>)}
          </ul>
        </Panel>

        <Panel title="Verbrauch diesen Monat" className="lg:col-span-2">
          {plan.hasPlan ? <UsageBar used={usage.minutes} included={plan.includedMinutes} /> : <p className="text-sm text-zinc-400">{new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(usage.minutes)} Minuten</p>}
          {plan.hasPlan && (
            <p className={cn("mt-2 text-xs", willExceed ? "text-amber-300" : "text-zinc-500")}>
              Hochrechnung bis Monatsende: ca. {data.projectedMinutes} Minuten{willExceed ? (plan.overageMode === "BLOCK" ? " – das Kontingent reicht voraussichtlich nicht; danach gehen Anrufe an Ihre Ausweichnummer." : " – voraussichtlich mit Zusatzminuten.") : " – im Rahmen Ihres Pakets."}
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
            {[["Anrufe", usage.calls], ["Vorgänge", usage.tickets], ["Notfälle", usage.emergencies], ["E-Mails", usage.emails], ["SMS", usage.sms], ["SMS inkl.", plan.includedSms]].map(([l, v]) => (
              <div key={String(l)} className="rounded-lg border border-zinc-800 p-2"><div className="text-lg font-semibold text-zinc-50">{v}</div><div className="text-zinc-500">{l}</div></div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Minuten pro Tag">
          <AreaChart ariaLabel="Gesprächsminuten pro Tag im laufenden Monat" unit="Min." height={150} data={data.daily.map((d) => ({ label: `${d.day}.`, value: d.minutes }))} />
        </Panel>
        <Panel title="Minuten der letzten 6 Monate">
          <BarChart ariaLabel="Gesprächsminuten der letzten sechs Monate" unit="Min." highlightLast data={data.history.map((h) => ({ label: monthName(h.period), value: h.minutes }))} />
        </Panel>
      </div>

      {data.invoice && (
        <Panel title="Voraussichtliche Rechnung diesen Monat">
          <ul className="space-y-1 text-sm">
            {data.invoice.lines.map((l, i) => <li key={i} className="flex justify-between gap-2"><span className="text-zinc-300">{l.label}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span><span className="tabular-nums">{eur(l.totalCents)}</span></li>)}
            {data.invoice.lines.length === 0 && <li className="text-zinc-500">Keine Berechnung hinterlegt.</li>}
          </ul>
          <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2 text-sm">
            <div className="flex justify-between"><span>Netto</span><span className="tabular-nums">{eur(data.invoice.netCents)}</span></div>
            <div className="flex justify-between text-zinc-500"><span>USt. {data.invoice.vatPercent} %</span><span className="tabular-nums">{eur(data.invoice.vatCents)}</span></div>
            <div className="flex justify-between font-semibold text-zinc-50"><span>Brutto</span><span className="tabular-nums">{eur(data.invoice.grossCents)}</span></div>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Vorschau auf Basis des bisherigen Verbrauchs. Maßgeblich ist die Rechnung Ihres Anbieters.</p>
        </Panel>
      )}
    </div>
  );
}
