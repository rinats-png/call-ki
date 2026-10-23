"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2, Save } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, eur } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { InfoTip } from "@/components/InfoTip";
import { UsageBar } from "@/components/UsageBar";
import { apiDownload, apiFetch } from "@/components/session";

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-50">Abrechnung
            <InfoTip title="Abrechnung" steps={["Vorschau je Kunde aus Paket und tatsächlichem Verbrauch – es wird keine Rechnung verschickt.", "CSV-Export für deine Buchhaltung oder dein Rechnungsprogramm (lexoffice, sevDesk …).", "Einkaufskosten unten eintragen (was dich Telefonie, KI und SMS pro Minute kosten) – daraus ergibt sich die Marge."]} />
          </h1>
          <p className="text-sm text-zinc-500">Verbrauch, Rechnungsvorschau und Marge je Kunde.</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Monat">
            {months.map((m) => <option key={m} value={m}>{new Date(`${m}-01T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => apiDownload(`/api/admin/billing?month=${month}&format=csv`, `abrechnung-${month}.csv`)}><Download className="h-4 w-4" />CSV</button>
        </div>
      </header>

      {!data ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Umsatz netto" value={eur(data.totals.netCents)} />
            <Kpi label="Einkaufskosten" value={eur(data.totals.costCents)} hint={data.costs.configured ? undefined : "Schätzwerte – unten anpassen"} />
            <Kpi label="Marge" value={eur(data.totals.marginCents)} tone={data.totals.marginCents >= 0 ? "good" : "bad"} />
            <Kpi label="Gesprächsminuten" value={new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(data.totals.minutes)} hint={`${data.totals.calls} Anrufe`} />
          </div>

          <Panel title="Kunden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr><th className="py-2">Kunde</th><th>Paket</th><th className="w-56">Minuten</th><th className="text-right">SMS</th><th className="text-right">Netto</th><th className="text-right">Kosten</th><th className="text-right">Marge</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.rows.map((r) => (
                    <tr key={r.tenantId}>
                      <td className="py-2.5"><Link href={`/admin/tenants/${r.tenantId}`} className="text-zinc-100 hover:text-cyan-300">{r.tenantName}</Link></td>
                      <td className="text-zinc-400">{r.plan.name}</td>
                      <td className="pr-4"><UsageBar used={r.usage.minutes} included={r.plan.includedMinutes} /></td>
                      <td className="text-right tabular-nums text-zinc-300">{r.usage.sms}</td>
                      <td className="text-right tabular-nums text-zinc-100">{eur(r.invoice.netCents)}</td>
                      <td className="text-right tabular-nums text-zinc-400">{eur(r.cost.totalCents)}</td>
                      <td className={cn("text-right tabular-nums", r.marginCents >= 0 ? "text-emerald-300" : "text-rose-300")}>{eur(r.marginCents)}</td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-zinc-500">Noch keine Kunden.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>

          <CostSettings costs={data.costs} onSaved={reload} />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="glass p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-zinc-50")}>{value}</div>
      {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
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
