"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2, Save } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, eur } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { PageHero, heroBtn } from "@/components/PageHero";
import { InfoTip } from "@/components/InfoTip";
import { UsageBar } from "@/components/UsageBar";
import { apiDownload, apiFetch } from "@/components/session";
import { PlanRequests } from "@/components/admin/PlanRequests";

type Row = {
  tenantId: string; tenantName: string; status: string;
  plan: { name: string; includedMinutes: number; overageMode: string };
  usage: { calls: number; minutes: number; sms: number };
  invoice: { netCents: number; grossCents: number; overageMinutes: number };
  cost: { totalCents: number }; marginCents: number; usagePercent: number | null;
};
type Report = {
  period: string; rows: Row[];
  totals: { netCents: number; grossCents: number; costCents: number; marginCents: number; minutes: number; calls: number };
  costs: { configured: boolean; telephony: string; voice: string; sms: string; vat: string };
};

function monthOptions() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 13; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function Page() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0]);
  const { data, reload } = usePoll<Report>(`/api/admin/billing?month=${month}`, 0);

  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const t = data?.totals;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow={`Rechnungsvorschau · ${monthLabel}`}
        title="Abrechnung"
        value={t ? eur(t.netCents, { decimals: 0 }) : "–"}
        valueLabel="Umsatz netto"
        stats={[
          { label: data?.costs.configured ? "Einkaufskosten" : "Kosten (geschätzt)", value: t ? eur(t.costCents, { decimals: 0 }) : "–" },
          { label: "Marge", value: t ? (t.netCents > 0 ? `${Math.round((t.marginCents / t.netCents) * 100)} %` : "–") : "–" },
          { label: "Gesprächsminuten", value: t ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(t.minutes) : "–" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <select className="input w-auto rounded-full py-2 font-semibold" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Monat">
              {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</option>)}
            </select>
            <button className={heroBtn} onClick={() => apiDownload(`/api/admin/billing?month=${month}&format=csv`, `abrechnung-${month}.csv`)}><Download className="h-4 w-4" />CSV</button>
          </div>
        }
      />

      <PlanRequests />

      {!data ? <Skeleton className="h-96 rounded-3xl" /> : (
        <>
          <section className="glass p-2 md:p-3">
            <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-2">
              <h2 className="flex items-center gap-1 text-sm font-bold text-zinc-100">Kunden<InfoTip title="Abrechnung" steps={["Vorschau je Kunde aus Paket und tatsächlichem Verbrauch – es wird keine Rechnung verschickt.", "CSV-Export für deine Buchhaltung oder dein Rechnungsprogramm (lexoffice, sevDesk …).", "Einkaufskosten unten eintragen (was dich Telefonie, KI und SMS pro Minute kosten) – daraus ergibt sich die Marge."]} /></h2>
              <span className="text-xs text-zinc-500">{data.rows.length} Kunden · {data.totals.calls} Anrufe</span>
            </div>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_60px_repeat(3,minmax(0,0.8fr))] gap-4 px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 lg:grid">
              <span>Kunde</span><span>Minuten</span><span className="text-right">SMS</span><span className="text-right">Netto</span><span className="text-right">Kosten</span><span className="text-right">Marge</span>
            </div>
            <ul className="space-y-1.5">
              {data.rows.map((r) => (
                <li key={r.tenantId}>
                  <Link href={`/admin/tenants/${r.tenantId}`} className="glass-soft grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-zinc-800/70 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_60px_repeat(3,minmax(0,0.8fr))]">
                    <span className="col-span-2 min-w-0 lg:col-span-1">
                      <span className="block truncate font-bold text-zinc-50">{r.tenantName}</span>
                      <span className="block text-xs text-zinc-500">Paket {r.plan.name}{r.invoice.overageMinutes > 0 ? ` · ${r.invoice.overageMinutes} Überminuten` : ""}</span>
                    </span>
                    <UsageBar className="col-span-2 lg:col-span-1" used={r.usage.minutes} included={r.plan.includedMinutes} />
                    <span className="text-xs text-zinc-500 lg:text-right lg:text-sm lg:text-zinc-300"><span className="lg:hidden">SMS </span><span className="tabular-nums">{r.usage.sms}</span></span>
                    <span className="text-right text-sm font-bold tabular-nums text-zinc-50"><span className="mr-1 text-xs font-normal text-zinc-500 lg:hidden">Netto</span>{eur(r.invoice.netCents)}</span>
                    <span className="text-xs tabular-nums text-zinc-400 lg:text-right lg:text-sm"><span className="mr-1 text-zinc-500 lg:hidden">Kosten</span>{eur(r.cost.totalCents)}</span>
                    <span className={cn("text-right text-sm font-semibold tabular-nums", r.marginCents >= 0 ? "text-emerald-400" : "text-rose-400")}><span className="mr-1 text-xs font-normal text-zinc-500 lg:hidden">Marge</span>{eur(r.marginCents)}</span>
                  </Link>
                </li>
              ))}
              {data.rows.length === 0 && <li className="py-10 text-center text-sm text-zinc-500">Noch keine Kunden.</li>}
            </ul>
          </section>

          <CostSettings costs={data.costs} onSaved={reload} />
        </>
      )}
    </div>
  );
}

function CostSettings({ costs, onSaved }: { costs: Report["costs"]; onSaved: () => void }) {
  const [v, setV] = useState({ COST_TELEPHONY_CENTS_PER_MIN: costs.telephony, COST_VOICE_CENTS_PER_MIN: costs.voice, COST_SMS_CENTS: costs.sms, VAT_PERCENT: costs.vat });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      for (const [key, value] of Object.entries(v)) await apiFetch("/api/admin/settings", { method: "PUT", json: { key, value: value.replace(",", ".").trim() || null } });
      setMsg("Gespeichert.");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }
  const field = (k: keyof typeof v, label: string, placeholder: string, help: string[]) => (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-400">{label}<InfoTip title={label} steps={help} /></span>
      <input className="input" inputMode="decimal" value={v[k]} placeholder={placeholder} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  );
  return (
    <Panel title="Einkaufskosten & Steuer">
      <div className="grid gap-3 sm:grid-cols-4">
        {field("COST_TELEPHONY_CENTS_PER_MIN", "Telefonie (Cent/Min.)", "1,5", ["Was dich eine eingehende Minute bei Twilio kostet, inkl. Weiterleitung.", "Twilio-Konsole → Billing → Usage, Gesamtkosten Voice ÷ Minuten."])}
        {field("COST_VOICE_CENTS_PER_MIN", "Sprach-KI (Cent/Min.)", "10", ["Minutenpreis deines KI-Anbieters inkl. LLM und Stimme (Retell, Vapi, ElevenLabs …).", "Bei Dollar-Preisen in Euro-Cent umrechnen."])}
        {field("COST_SMS_CENTS", "SMS (Cent je SMS)", "8", ["Twilio-Preis je SMS nach Deutschland."])}
        {field("VAT_PERCENT", "Umsatzsteuer (%)", "19", ["Für die Brutto-Anzeige. Kleinunternehmer: 0."])}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Speichern</button>
        {msg && <span className="text-xs text-zinc-400">{msg}</span>}
      </div>
    </Panel>
  );
}
