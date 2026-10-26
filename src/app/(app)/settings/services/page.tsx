"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { InfoTip } from "@/components/InfoTip";
import { apiFetch, useModule, useSession } from "@/components/session";

type Service = { id: string; name: string; aliases: string; trade: string; durationMin: number; priceCents: number; unit: string; taxRate: number; active: boolean; sort: number };
type Data = { services: Service[]; trades: string[] };
type Form = Omit<Service, "id" | "priceCents"> & { id: string; price: string };

const EMPTY: Form = { id: "", name: "", aliases: "", trade: "", durationMin: 60, price: "", unit: "pauschal", taxRate: 19, active: true, sort: 0 };
const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const UNITS = ["pauschal", "Stück", "Stunde", "m", "m²", "km"];

/** Leistungskatalog: Dauer (Terminbuchung), Gewerk (Zuständigkeit), Preis (Rechnung) */
export default function ServicesPage() {
  const { isTenantAdmin } = useSession();
  // Preis, Einheit und Steuer braucht nur, wer Rechnungen gebucht hat
  const invoicing = useModule("invoicing");
  const { data, reload } = usePoll<Data>("/api/services", 30000);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setErr(null);
    const { id, price, ...rest } = form;
    const priceCents = Math.round(Number((price || "0").replace(/\./g, "").replace(",", ".")) * 100);
    try {
      if (!Number.isFinite(priceCents) || priceCents < 0) throw new Error("Preis bitte als Zahl, z. B. 89,00");
      await apiFetch("/api/services", { method: "POST", json: { ...rest, ...(id && { id }), priceCents, durationMin: Number(rest.durationMin), taxRate: Number(rest.taxRate), sort: Number(rest.sort) } });
      setForm(null);
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }
  async function remove(s: Service) {
    if (!confirm(`„${s.name}“ löschen? Vorgänge behalten ihre Kategorie.`)) return;
    await apiFetch(`/api/services/${s.id}`, { method: "DELETE" });
    reload();
  }
  const set = <K extends keyof Form>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    form && setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  if (!data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <Panel
        title={<span className="flex items-center gap-2">Leistungen<InfoTip title="Wofür der Katalog da ist" steps={[
          "Dauer: So lange blockt die KI den Termin im Kalender, wenn ein Anliegen zu dieser Leistung passt.",
          "Gewerk: Die KI wählt bevorzugt Mitarbeiter mit diesem Gewerk (unter Team). Leer = jeder.",
          ...(invoicing ? ["Preis und Einheit: Vorschlag für Rechnungspositionen. 0 = nach Aufwand."] : []),
          "Weitere Begriffe: Wörter, unter denen Anrufer die Leistung nennen, z. B. „Rohrbruch, Wasserschaden“.",
        ]} /></span>}
        action={isTenantAdmin && <button className="btn-primary" onClick={() => { setErr(null); setForm({ ...EMPTY }); }}><Plus className="h-4 w-4" />Leistung</button>}
      >
        {data.services.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Noch keine Leistungen. Ohne Katalog gilt die Standarddauer aus „Termine &amp; Notfall“ und jeder Mitarbeiter kommt für alles infrage.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr><th className="py-2 pr-3">Leistung</th><th className="pr-3">Gewerk</th><th className="pr-3 text-right">Dauer</th>{invoicing && <><th className="pr-3 text-right">Preis netto</th><th className="pr-3">USt.</th></>}<th /></tr>
              </thead>
              <tbody>
                {data.services.map((s) => (
                  <tr key={s.id} className={s.active ? "border-t border-zinc-800" : "border-t border-zinc-800 opacity-50"}>
                    <td className="py-2.5 pr-3"><div className="font-semibold text-zinc-100">{s.name}</div>{s.aliases && <div className="text-xs text-zinc-500">auch: {s.aliases}</div>}</td>
                    <td className="pr-3 text-zinc-300">{s.trade || "—"}</td>
                    <td className="pr-3 text-right font-mono text-zinc-300">{s.durationMin} min</td>
                    {invoicing && <><td className="pr-3 text-right font-mono text-zinc-300">{s.priceCents ? `${euro(s.priceCents)} / ${s.unit}` : "nach Aufwand"}</td>
                    <td className="pr-3 text-zinc-400">{s.taxRate} %</td></>}
                    <td className="whitespace-nowrap text-right">
                      {isTenantAdmin && <>
                        <button className="btn-ghost p-2" aria-label={`${s.name} bearbeiten`} onClick={() => { setErr(null); setForm({ ...s, price: s.priceCents ? (s.priceCents / 100).toFixed(2).replace(".", ",") : "" }); }}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="btn-ghost p-2" aria-label={`${s.name} löschen`} onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {form && (
        <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setForm(null)} />
          <form onSubmit={save} className="glass relative w-full max-w-lg space-y-2 p-5 animate-fadein">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">{form.id ? "Leistung bearbeiten" : "Neue Leistung"}</h3>
              <button type="button" className="btn-ghost p-2" onClick={() => setForm(null)} aria-label="Schließen"><X className="h-4 w-4" /></button>
            </header>
            <input className="input" placeholder="Name, z. B. Rohrbruch" required value={form.name} onChange={set("name")} />
            <input className="input" placeholder="Weitere Begriffe, kommagetrennt (z. B. Wasserschaden, Leck)" value={form.aliases} onChange={set("aliases")} />
            <input className="input" list="trades" placeholder="Gewerk, z. B. Sanitär" value={form.trade} onChange={set("trade")} />
            <datalist id="trades">{data.trades.map((t) => <option key={t} value={t} />)}</datalist>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-400">Dauer (Minuten)<input className="input mt-1" type="number" min={0} max={1440} value={form.durationMin} onChange={set("durationMin")} /></label>
              {invoicing && <><label className="text-xs text-zinc-400">Preis netto (€)<input className="input mt-1" inputMode="decimal" placeholder="0 = nach Aufwand" value={form.price} onChange={set("price")} /></label>
              <label className="text-xs text-zinc-400">Einheit<select className="input mt-1" value={form.unit} onChange={set("unit")}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="text-xs text-zinc-400">Umsatzsteuer<select className="input mt-1" value={form.taxRate} onChange={set("taxRate")}><option value={19}>19 %</option><option value={7}>7 %</option><option value={0}>0 %</option></select></label></>}
            </div>
            <label className="flex items-center gap-2 pt-1 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={set("active")} />Aktiv ({invoicing ? "KI und Rechnungen nutzen" : "die KI nutzt"} diese Leistung)</label>
            {err && <p className="text-xs text-amber-400">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Abbrechen</button>
              <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
