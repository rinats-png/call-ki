"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { centsToInput, cn, eur, parseEuro } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { PageHero, heroBtn } from "@/components/PageHero";
import { InfoTip } from "@/components/InfoTip";
import { apiFetch } from "@/components/session";
import { PLAN_FEATURES } from "@/lib/platform/registry";

type Plan = {
  id: string; key: string; name: string; description: string; active: boolean;
  monthlyPriceCents: number; setupFeeCents: number; includedMinutes: number; overageCentsPerMinute: number;
  overageMode: "CHARGE" | "BLOCK"; billingIncrementSec: number; includedSms: number; smsCents: number;
  maxNumbers: number | null; maxUsers: number | null; features: string[]; sortOrder: number; tenantCount?: number;
};

const EMPTY: Plan = { id: "", key: "", name: "", description: "", active: true, monthlyPriceCents: 0, setupFeeCents: 0, includedMinutes: 100, overageCentsPerMinute: 39, overageMode: "CHARGE", billingIncrementSec: 60, includedSms: 0, smsCents: 15, maxNumbers: 1, maxUsers: 3, features: ["calendar_internal", "email_notifications"], sortOrder: 10 };

export default function Page() {
  const { data, reload } = usePoll<Plan[]>("/api/admin/plans", 0);
  const [creating, setCreating] = useState(false);
  if (!data) return <div className="mx-auto max-w-[1500px]"><Skeleton className="h-96 rounded-3xl" /></div>;
  const active = data.filter((p) => p.active);
  const customers = data.reduce((n, p) => n + (p.tenantCount ?? 0), 0);
  const mrr = data.reduce((n, p) => n + (p.tenantCount ?? 0) * p.monthlyPriceCents, 0);
  const top = Math.max(0, ...data.map((p) => p.tenantCount ?? 0));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow="Alle Beträge netto"
        title="Preise & Pakete"
        value={active.length}
        valueLabel={`aktive Pakete${data.length > active.length ? ` · ${data.length - active.length} inaktiv` : ""}`}
        stats={[
          { label: "Kunden mit Paket", value: customers },
          { label: "Grundgebühren / Monat", value: eur(mrr, { decimals: 0 }) },
          { label: "Ab", value: active.length ? eur(Math.min(...active.map((p) => p.monthlyPriceCents)), { decimals: 0 }) : "–" },
        ]}
        action={<button className={heroBtn} onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Neues Paket</button>}
      />

      <h2 className="flex items-center gap-1 px-1 text-sm font-bold text-zinc-100">So funktionieren Pakete
        <InfoTip title="So funktionieren Pakete" steps={["Jedes Paket hat einen Monatspreis mit Freiminuten. Darüber hinaus gilt der Preis je Überminute – oder „Stopp“: Anrufe gehen dann an die Fallback-Nummer.", "Abrechnungstakt 60 s = jede angefangene Minute je Gespräch zählt voll; 1 s = sekundengenau.", "Funktionen steuern, was der Kunde nutzen darf (z. B. Outlook/Google, SMS).", "Einzelnen Kunden kannst du Sonderpreise unter Verwaltung → Kunde geben.", "Alle Preise netto; die Umsatzsteuer stellst du unter Abrechnung ein."]} />
      </h2>

      {creating && <PlanEditor plan={EMPTY} isNew onDone={() => { setCreating(false); reload(); }} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((p) => <PlanCard key={p.id} plan={p} popular={top > 0 && (p.tenantCount ?? 0) === top} onChanged={reload} />)}
      </div>

      <AddonPrices />
    </div>
  );
}

type AddonRow = { key: string; name: string; tagline: string; priceCents: number; active: boolean; bookings: number };

/** Preise der Zusatzoptionen: gelten für neue Buchungen; bestehende behalten ihren Preis. */
function AddonPrices() {
  const { data, reload } = usePoll<{ addons: AddonRow[] }>("/api/admin/addons", 0);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return null;
  async function save(a: AddonRow, patch: Partial<AddonRow>) {
    setErr(null);
    try {
      await apiFetch("/api/admin/addons", { method: "PUT", json: { key: a.key, monthlyPriceCents: patch.priceCents ?? a.priceCents, active: patch.active ?? a.active } });
      reload();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Panel title={<span className="flex items-center gap-1">Zusatzoptionen<InfoTip title="Zusatzoptionen" steps={["Kunden buchen sie selbst unter Tarif – die Funktionen erscheinen dann in ihrer Oberfläche.", "Preisänderungen gelten nur für neue Buchungen.", "Nicht buchbar = wird Kunden nicht mehr angeboten; bestehende Buchungen laufen weiter.", "In ein Paket aufnehmen: unter „Enthaltene Funktionen“ die passende Zusatzoption anhaken."]} /></span>}>
      <div className="grid gap-3 md:grid-cols-3">
        {data.addons.map((a) => (
          <div key={a.key} className="rounded-lg border border-zinc-800 p-3 text-sm">
            <div className="font-medium text-zinc-100">{a.name}</div>
            <div className="text-xs text-zinc-500">{a.tagline} · {a.bookings} aktiv gebucht</div>
            <div className="mt-2 flex items-center gap-2">
              <input className="input w-28" inputMode="decimal" defaultValue={centsToInput(a.priceCents)} key={a.priceCents} aria-label={`Preis ${a.name}`} onBlur={(e) => { const c = parseEuro(e.target.value); if (c != null && c !== a.priceCents) save(a, { priceCents: c }); }} />
              <span className="text-xs text-zinc-500">€ netto / Monat</span>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={a.active} onChange={(e) => save(a, { active: e.target.checked })} />buchbar</label>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-amber-400">{err}</p>}
    </Panel>
  );
}

function PlanCard({ plan, popular, onChanged }: { plan: Plan; popular?: boolean; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  if (edit) return <div className="md:col-span-2 xl:col-span-3"><PlanEditor plan={plan} onDone={() => { setEdit(false); onChanged(); }} /></div>;
  return (
    <div className={cn("glass flex flex-col p-6", popular && "ring-2 ring-cyan-400/60", !plan.active && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{plan.key}{!plan.active && " · inaktiv"}</div>
          <h2 className="text-xl font-extrabold text-zinc-50">{plan.name}</h2>
        </div>
        <span className="flex flex-col items-end gap-1">{popular && <span className="chip border-transparent bg-cyan-500 text-[rgb(var(--on-accent))]">meistgenutzt</span>}<span className="chip border-zinc-700 text-zinc-400">{plan.tenantCount ?? 0} Kunden</span></span>
      </div>
      <div className="mt-3 text-4xl font-extrabold tracking-tight text-zinc-50">{eur(plan.monthlyPriceCents)}<span className="text-sm font-normal text-zinc-500"> / Monat</span></div>
      {plan.setupFeeCents > 0 && <div className="text-xs text-zinc-500">+ {eur(plan.setupFeeCents)} Einrichtung</div>}
      <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
      <ul className="glass-soft mt-4 space-y-1 p-3 text-sm text-zinc-300">
        <li><b className="text-zinc-50">{plan.includedMinutes}</b> Freiminuten</li>
        <li>{plan.overageMode === "BLOCK" ? "Stopp nach Kontingent (Fallback)" : <>danach <b className="text-zinc-50">{eur(plan.overageCentsPerMinute)}</b> / Min.</>}</li>
        <li>{plan.includedSms} SMS inklusive, danach {eur(plan.smsCents)}</li>
        <li>{plan.maxNumbers ?? "∞"} Rufnummer(n), {plan.maxUsers ?? "∞"} Zugänge</li>
      </ul>
      <ul className="mt-3 flex flex-wrap gap-1">
        {plan.features.map((f) => <li key={f} className="chip border-cyan-500/30 bg-cyan-500/10 text-[11px] text-cyan-200">{PLAN_FEATURES.find((x) => x.key === f)?.label ?? f}</li>)}
      </ul>
      <div className="mt-auto pt-4"><button className="btn-ghost w-full justify-center" onClick={() => setEdit(true)}>Bearbeiten</button></div>
    </div>
  );
}

function PlanEditor({ plan, isNew, onDone }: { plan: Plan; isNew?: boolean; onDone: () => void }) {
  const [p, setP] = useState(plan);
  const [money, setMoney] = useState({ monthly: centsToInput(plan.monthlyPriceCents), setup: centsToInput(plan.setupFeeCents), overage: centsToInput(plan.overageCentsPerMinute), sms: centsToInput(plan.smsCents) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setP((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        key: p.key, name: p.name, description: p.description, active: p.active,
        monthlyPriceCents: parseEuro(money.monthly) ?? 0, setupFeeCents: parseEuro(money.setup) ?? 0,
        includedMinutes: p.includedMinutes, overageCentsPerMinute: parseEuro(money.overage) ?? 0, overageMode: p.overageMode,
        billingIncrementSec: p.billingIncrementSec, includedSms: p.includedSms, smsCents: parseEuro(money.sms) ?? 0,
        maxNumbers: p.maxNumbers, maxUsers: p.maxUsers, features: p.features, sortOrder: p.sortOrder,
      };
      if (isNew) await apiFetch("/api/admin/plans", { method: "POST", json: body });
      else await apiFetch(`/api/admin/plans/${p.id}`, { method: "PATCH", json: body });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Paket „${p.name}“ löschen?`)) return;
    try {
      await apiFetch(`/api/admin/plans/${p.id}`, { method: "DELETE" });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.floor(Number(v))));

  return (
    <Panel title={isNew ? "Neues Paket" : `Paket bearbeiten: ${plan.name}`}>
      <div className="grid gap-3 sm:grid-cols-4">
        <L label="Name"><input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Business" /></L>
        <L label="Kürzel" help={["Eindeutig, nur A–Z, 0–9 und _. Wird intern verwendet, z. B. BUSINESS."]}><input className="input font-mono" value={p.key} onChange={(e) => set("key", e.target.value.toUpperCase())} placeholder="BUSINESS" /></L>
        <L label="Monatspreis (€ netto)"><input className="input" inputMode="decimal" value={money.monthly} onChange={(e) => setMoney({ ...money, monthly: e.target.value })} /></L>
        <L label="Einrichtungsgebühr (€)" help={["Wird im Monat des Vertragsbeginns (Anlage des Kunden) einmalig berechnet."]}><input className="input" inputMode="decimal" value={money.setup} onChange={(e) => setMoney({ ...money, setup: e.target.value })} /></L>
        <L label="Freiminuten / Monat"><input className="input" type="number" min={0} value={p.includedMinutes} onChange={(e) => set("includedMinutes", num(e.target.value) ?? 0)} /></L>
        <L label="Nach den Freiminuten" help={["Überminuten berechnen: Anrufe laufen weiter, jede weitere Minute kostet den Preis rechts.", "Stopp: Die KI nimmt nicht mehr ab, Anrufe gehen an die Fallback-Nummer bzw. Mailbox – gut für feste Budgets."]}>
          <select className="input" value={p.overageMode} onChange={(e) => set("overageMode", e.target.value as Plan["overageMode"])}>
            <option value="CHARGE">Überminuten berechnen</option>
            <option value="BLOCK">Stopp (Fallback)</option>
          </select>
        </L>
        <L label="Preis je Überminute (€)"><input className="input" inputMode="decimal" value={money.overage} onChange={(e) => setMoney({ ...money, overage: e.target.value })} disabled={p.overageMode === "BLOCK"} /></L>
        <L label="Abrechnungstakt" help={["Wie Gesprächsdauer gezählt wird: 60 s = jede angefangene Minute; 30 s; 1 s = sekundengenau."]}>
          <select className="input" value={p.billingIncrementSec} onChange={(e) => set("billingIncrementSec", Number(e.target.value))}>
            <option value={60}>je angefangene Minute</option>
            <option value={30}>30-Sekunden-Takt</option>
            <option value={1}>sekundengenau</option>
          </select>
        </L>
        <L label="SMS inklusive"><input className="input" type="number" min={0} value={p.includedSms} onChange={(e) => set("includedSms", num(e.target.value) ?? 0)} /></L>
        <L label="Preis je weitere SMS (€)"><input className="input" inputMode="decimal" value={money.sms} onChange={(e) => setMoney({ ...money, sms: e.target.value })} /></L>
        <L label="Max. Rufnummern"><input className="input" type="number" min={1} value={p.maxNumbers ?? ""} placeholder="unbegrenzt" onChange={(e) => set("maxNumbers", num(e.target.value))} /></L>
        <L label="Max. Zugänge"><input className="input" type="number" min={1} value={p.maxUsers ?? ""} placeholder="unbegrenzt" onChange={(e) => set("maxUsers", num(e.target.value))} /></L>
        <div className="sm:col-span-4"><L label="Beschreibung (für Angebot & Kundenportal)"><textarea className="input min-h-[60px]" value={p.description} onChange={(e) => set("description", e.target.value)} /></L></div>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium text-zinc-400">Enthaltene Funktionen</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAN_FEATURES.map((f) => (
            <label key={f.key} className="flex items-start gap-2 rounded-lg border border-zinc-800 p-2 text-sm text-zinc-300">
              <input type="checkbox" className="mt-0.5" checked={p.features.includes(f.key)} onChange={(e) => set("features", e.target.checked ? [...p.features, f.key] : p.features.filter((x) => x !== f.key))} />
              <span>{f.label}<span className="block text-[11px] text-zinc-500">{f.help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="mr-auto flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} />Aktiv (für neue Kunden wählbar)</label>
        {err && <span className="text-xs text-amber-300">{err}</span>}
        {!isNew && <button className="btn-ghost text-rose-400" onClick={remove}><Trash2 className="h-4 w-4" />Löschen</button>}
        <button className="btn-ghost" onClick={onDone}>Abbrechen</button>
        <button className="btn-primary" disabled={busy || !p.name || !p.key} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Speichern</button>
      </div>
    </Panel>
  );
}

function L({ label, help, children }: { label: string; help?: string[]; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-zinc-400">{label}{help && <InfoTip title={label} steps={help} />}</span>
      {children}
    </label>
  );
}
