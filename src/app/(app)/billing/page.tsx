"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { PageHero } from "@/components/PageHero";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiFetch, useModule, useSession } from "@/components/session";
import { ModuleGate } from "@/components/ModuleGate";
import { BankImportButton, BankSuggestions } from "@/components/BankImport";

type Kind = "QUOTE" | "INVOICE" | "CREDIT_NOTE";
type Cust = { id: string; name: string | null; companyName: string | null; phone: string };
type Row = { id: string; kind: Kind; status: string; number: string | null; issueDate: string | null; dueAt: string | null; grossCents: number; reminderLevel: number; paidAt: string | null; createdAt: string; customer: Cust; ticketId: string | null };
type List = { bills: Row[]; stats: { openCount: number; openCents: number; overdueCount: number; overdueCents: number }; issuerMissing: string[] };
type Line = { description: string; quantity: number; unit: string; unitCents: number; taxRate: number; serviceId?: string | null; totalCents?: number };
type Detail = Row & { lines: Line[]; netCents: number; taxCents: number; taxes: { rate: number; netCents: number; taxCents: number }[]; smallBusiness: boolean; introText: string | null; note: string | null; serviceDate: string | null; link: string | null; related: { id: string; number: string | null; kind: Kind } | null; children: { id: string; number: string | null; kind: Kind; status: string }[]; issuerMissing: string[]; customer: Cust & { email: string | null; address: string | null } };
type Service = { id: string; name: string; priceCents: number; unit: string; taxRate: number; active: boolean };
type Form = { id: string | null; kind: "QUOTE" | "INVOICE"; customerId: string; lines: (Omit<Line, "unitCents" | "quantity"> & { price: string; qty: string })[]; introText: string; note: string; serviceDate: string };

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE") : "—");
const KIND: Record<Kind, string> = { QUOTE: "Angebot", INVOICE: "Rechnung", CREDIT_NOTE: "Gutschrift" };
const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Entwurf", "bg-zinc-500/15 text-zinc-300"],
  ISSUED: ["Offen", "bg-cyan-400/15 text-cyan-300"],
  PAID: ["Bezahlt", "bg-emerald-400/15 text-emerald-300"],
  CANCELLED: ["Storniert", "bg-zinc-500/15 text-zinc-400 line-through"],
  ACCEPTED: ["Angenommen", "bg-emerald-400/15 text-emerald-300"],
  DECLINED: ["Abgelehnt", "bg-amber-400/15 text-amber-300"],
};
const custName = (c: Cust) => c.companyName || c.name || c.phone;
const money = (s: string) => Math.round(Number((s || "0").replace(/\./g, "").replace(",", ".")) * 100);
const num = (s: string) => Number((s || "0").replace(",", "."));
const toForm = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const overdue = (r: Row) => r.kind === "INVOICE" && r.status === "ISSUED" && !!r.dueAt && new Date(r.dueAt).getTime() < Date.now();

/** Angebote, Rechnungen, Gutschriften: Entwurf → ausstellen (fortlaufende Nummer, unveränderlich) → senden → bezahlt */
export default function BillingPage() {
  const { me } = useSession();
  return <ModuleGate module="invoicing" allow={me?.tenant?.hasBills}><Billing /></ModuleGate>;
}

function Billing() {
  const { isTenantAdmin } = useSession();
  // Nach Kündigung der Zusatzoption: Archiv (ansehen, bezahlt markieren, stornieren) – keine neuen Belege
  const active = useModule("invoicing");
  const [kind, setKind] = useState<"" | Kind>("");
  const { data, reload } = usePoll<List>(`/api/bills${kind ? `?kind=${kind}` : ""}`, 20000);
  const { data: customers } = usePoll<Cust[]>("/api/customers", 60000);
  const { data: cat } = usePoll<{ services: Service[] }>("/api/services", 60000);
  const [form, setForm] = useState<Form | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (id: string) => { setErr(null); setOpen(await apiFetch<Detail>(`/api/bills/${id}`)); };
  const newForm = (k: "QUOTE" | "INVOICE"): Form => ({ id: null, kind: k, customerId: "", lines: [{ description: "", qty: "1", unit: "pauschal", price: "", taxRate: 19 }], introText: "", note: "", serviceDate: "" });
  const editForm = (b: Detail): Form => ({ id: b.id, kind: b.kind === "QUOTE" ? "QUOTE" : "INVOICE", customerId: b.customer.id, lines: b.lines.map((l) => ({ ...l, qty: String(l.quantity).replace(".", ","), price: toForm(l.unitCents) })), introText: b.introText ?? "", note: b.note ?? "", serviceDate: b.serviceDate ? b.serviceDate.slice(0, 10) : "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setErr(null);
    try {
      const lines = form.lines.filter((l) => l.description.trim()).map(({ qty, price, ...l }) => ({ description: l.description, unit: l.unit, serviceId: l.serviceId ?? null, quantity: num(qty), unitCents: money(price), taxRate: Number(l.taxRate) }));
      if (!lines.length) throw new Error("Mindestens eine Position.");
      if (lines.some((l) => !Number.isFinite(l.quantity) || !Number.isFinite(l.unitCents))) throw new Error("Menge und Preis bitte als Zahl.");
      const json = { customerId: form.customerId, lines, introText: form.introText || null, note: form.note || null, serviceDate: form.serviceDate ? new Date(form.serviceDate).toISOString() : null };
      const b = form.id
        ? await apiFetch<{ id: string }>(`/api/bills/${form.id}`, { method: "PATCH", json })
        : await apiFetch<{ id: string }>("/api/bills", { method: "POST", json: { ...json, kind: form.kind } });
      setForm(null); reload(); await load(b.id);
    } catch (e2) { setErr((e2 as Error).message); }
    setBusy(false);
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!open) return;
    if (action === "issue" && !confirm(`${KIND[open.kind]} jetzt ausstellen? Danach ist sie nicht mehr änderbar (nur noch Storno).`)) return;
    let body: Record<string, unknown> = { action, ...extra };
    if (action === "cancel") {
      const reason = prompt("Rechnung stornieren – es wird eine Gutschrift erstellt. Grund (optional):");
      if (reason === null) return;
      body = { ...body, reason };
    }
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch<{ id?: string } | null>(`/api/bills/${open.id}/action`, { method: "POST", json: body });
      reload();
      await load(action === "convert" && r && "id" in r && r.id ? r.id : open.id);
    } catch (e2) { setErr((e2 as Error).message); }
    setBusy(false);
  }
  async function remove() {
    if (!open || !confirm("Entwurf löschen?")) return;
    await apiFetch(`/api/bills/${open.id}`, { method: "DELETE" });
    setOpen(null); reload();
  }
  function pick(i: number, serviceId: string) {
    if (!form) return;
    const s = cat?.services.find((x) => x.id === serviceId);
    const lines = [...form.lines];
    lines[i] = s ? { ...lines[i], serviceId: s.id, description: s.name, unit: s.unit, price: s.priceCents ? toForm(s.priceCents) : lines[i].price, taxRate: s.taxRate } : { ...lines[i], serviceId: null };
    setForm({ ...form, lines });
  }
  const setLine = (i: number, patch: Partial<Form["lines"][number]>) => form && setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const formTotal = form?.lines.reduce((s, l) => s + Math.round(num(l.qty) * money(l.price)), 0) ?? 0;

  if (!data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Angebote, Rechnungen und Gutschriften – mit Überweisungs-QR-Code"
        title="Rechnungen"
        value={euro(data.stats.openCents)}
        valueLabel={`offen (${data.stats.openCount})`}
        stats={[{ label: `überfällig (${data.stats.overdueCount})`, value: euro(data.stats.overdueCents) }]}
        action={active && <div className="flex flex-wrap gap-2">{isTenantAdmin && <BankImportButton onDone={reload} />}<button className="btn-ghost" onClick={() => { setErr(null); setForm(newForm("QUOTE")); }}><Plus className="h-4 w-4" />Angebot</button><button className="btn-primary" onClick={() => { setErr(null); setForm(newForm("INVOICE")); }}><Plus className="h-4 w-4" />Rechnung</button></div>}
      />
      {!active && <p className="rounded-lg border border-zinc-700 bg-white/5 px-4 py-3 text-sm text-zinc-300">Archiv: Die Zusatzoption „Angebote &amp; Rechnungen“ ist nicht gebucht. Bestehende Belege bleiben einsehbar (Aufbewahrungspflicht), offene Rechnungen können Sie weiter als bezahlt markieren oder stornieren. {isTenantAdmin && <Link className="underline" href="/settings/plan#zusatzoptionen">Wieder buchen</Link>}</p>}
      {active && data.issuerMissing.length > 0 && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Zum Ausstellen fehlen noch: {data.issuerMissing.join(", ")}. {isTenantAdmin ? <Link className="underline" href="/settings/invoicing">Jetzt ergänzen</Link> : "Bitte Inhaber bzw. Admin fragen."}
        </p>
      )}
      {isTenantAdmin && <BankSuggestions onChanged={reload} />}
      <Panel title="Belege" action={
        <div className="flex gap-1">{([["", "Alle"], ["INVOICE", "Rechnungen"], ["QUOTE", "Angebote"], ["CREDIT_NOTE", "Gutschriften"]] as const).map(([k, l]) => (
          <button key={k} className={cn("rounded-md px-2.5 py-1 text-xs", kind === k ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-400 hover:text-zinc-200")} onClick={() => setKind(k)}>{l}</button>
        ))}</div>
      }>
        {data.bills.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Noch keine Belege. Positionen kommen aus dem Leistungskatalog (Einstellungen → Leistungen).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500"><tr><th className="py-2 pr-3">Nummer</th><th className="pr-3">Kunde</th><th className="pr-3">Datum</th><th className="pr-3">Fällig</th><th className="pr-3 text-right">Betrag</th><th>Status</th></tr></thead>
              <tbody>
                {data.bills.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-t border-zinc-800 hover:bg-white/5" onClick={() => load(r.id)}>
                    <td className="py-2.5 pr-3"><div className="font-mono text-zinc-100">{r.number ?? "—"}</div><div className="text-xs text-zinc-500">{KIND[r.kind]}</div></td>
                    <td className="pr-3 text-zinc-300">{custName(r.customer)}</td>
                    <td className="pr-3 text-zinc-400">{date(r.issueDate ?? r.createdAt)}</td>
                    <td className={cn("pr-3", overdue(r) ? "text-amber-300" : "text-zinc-400")}>{r.kind === "INVOICE" ? date(r.dueAt) : "—"}</td>
                    <td className="pr-3 text-right font-mono text-zinc-200">{euro(r.grossCents)}</td>
                    <td><Chip status={r.status} />{overdue(r) && <span className="ml-1 rounded px-1.5 py-0.5 text-[11px] bg-amber-400/15 text-amber-300">{r.reminderLevel ? (r.reminderLevel > 1 ? "gemahnt" : "erinnert") : "überfällig"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {open && (
        <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="glass relative max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-5 animate-fadein">
            <header className="flex items-start justify-between">
              <div><h3 className="font-semibold text-zinc-100">{KIND[open.kind]} {open.number ?? "(Entwurf)"} <Chip status={open.status} /></h3><p className="text-sm text-zinc-400">{custName(open.customer)}{open.customer.address ? ` · ${open.customer.address}` : ""}</p></div>
              <button className="btn-ghost p-2" onClick={() => setOpen(null)} aria-label="Schließen"><X className="h-4 w-4" /></button>
            </header>
            <table className="w-full text-sm">
              <tbody>
                {open.lines.map((l, i) => <tr key={i} className="border-t border-zinc-800"><td className="py-1.5 pr-2 text-zinc-200">{l.description}</td><td className="pr-2 text-right text-zinc-400">{String(l.quantity).replace(".", ",")} {l.unit}</td><td className="pr-2 text-right font-mono text-zinc-400">{euro(l.unitCents)}</td><td className="text-right font-mono text-zinc-200">{euro(l.totalCents ?? Math.round(l.quantity * l.unitCents))}</td></tr>)}
              </tbody>
            </table>
            <div className="ml-auto w-64 space-y-0.5 text-sm">
              <div className="flex justify-between text-zinc-400"><span>Netto</span><span className="font-mono">{euro(open.netCents)}</span></div>
              {open.smallBusiness ? <div className="text-xs text-zinc-500">Kein USt.-Ausweis (§ 19 UStG)</div> : open.taxes.map((t) => <div key={t.rate} className="flex justify-between text-zinc-400"><span>USt. {t.rate} %</span><span className="font-mono">{euro(t.taxCents)}</span></div>)}
              <div className="flex justify-between border-t border-zinc-700 pt-1 font-semibold text-zinc-100"><span>Gesamt</span><span className="font-mono">{euro(open.grossCents)}</span></div>
            </div>
            {open.related && <p className="text-xs text-zinc-500">Bezug: <button className="underline" onClick={() => load(open.related!.id)}>{KIND[open.related.kind]} {open.related.number}</button></p>}
            {open.children.length > 0 && <p className="text-xs text-zinc-500">Folgebelege: {open.children.map((c) => <button key={c.id} className="mr-2 underline" onClick={() => load(c.id)}>{KIND[c.kind]} {c.number ?? "(Entwurf)"}</button>)}</p>}
            {open.status === "DRAFT" && open.issuerMissing.length > 0 && <p className="text-xs text-amber-300">Zum Ausstellen fehlen: {open.issuerMissing.join(", ")}</p>}
            {err && <p className="text-sm text-amber-400">{err}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-3">
              {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-zinc-400" />}
              {open.link && <a className="btn-ghost" href={open.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Ansehen / Drucken</a>}
              {active && open.status === "DRAFT" && <>
                <button className="btn-ghost" onClick={remove}><Trash2 className="h-4 w-4" />Löschen</button>
                <button className="btn-ghost" onClick={() => { setForm(editForm(open)); setOpen(null); }}>Bearbeiten</button>
                <button className="btn-primary" disabled={busy} onClick={() => act("issue")}><FileText className="h-4 w-4" />Ausstellen</button>
              </>}
              {active && open.status === "ISSUED" && <button className="btn-ghost" disabled={busy || !open.customer.email} title={open.customer.email ? `an ${open.customer.email}` : "Kunde hat keine E-Mail-Adresse"} onClick={() => act("send")}>Per E-Mail senden</button>}
              {open.kind === "INVOICE" && open.status === "ISSUED" && <>
                {active && overdue(open) && <button className="btn-ghost" disabled={busy || !open.customer.email} onClick={() => act("remind")}>{open.reminderLevel ? "Mahnen" : "Erinnern"}</button>}
                {isTenantAdmin && <button className="btn-ghost" disabled={busy} onClick={() => act("cancel")}>Stornieren</button>}
                <button className="btn-primary" disabled={busy} onClick={() => act("paid")}>Als bezahlt markieren</button>
              </>}
              {active && open.kind === "QUOTE" && open.status === "ISSUED" && <>
                <button className="btn-ghost" disabled={busy} onClick={() => act("decline")}>Abgelehnt</button>
                <button className="btn-primary" disabled={busy} onClick={() => act("convert")}>Angenommen → Rechnung</button>
              </>}
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setForm(null)} />
          <form onSubmit={save} className="glass relative max-h-[90vh] w-full max-w-3xl space-y-3 overflow-y-auto p-5 animate-fadein">
            <header className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-100">{form.id ? "Entwurf bearbeiten" : `Neue${form.kind === "QUOTE" ? "s Angebot" : " Rechnung"}`}</h3>
              <button type="button" className="btn-ghost p-2" onClick={() => setForm(null)} aria-label="Schließen"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-zinc-400">Kunde<select className="input mt-1" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Bitte wählen …</option>{customers?.map((c) => <option key={c.id} value={c.id}>{custName(c)}{c.name && c.companyName ? ` (${c.name})` : ""}</option>)}</select></label>
              <label className="text-xs text-zinc-400">Leistungsdatum<input className="input mt-1" type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} /></label>
            </div>
            <input className="input" placeholder="Einleitung (optional), z. B. „Vielen Dank für Ihren Auftrag.“" value={form.introText} onChange={(e) => setForm({ ...form, introText: e.target.value })} />
            <div className="space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5">
                  <select className="input col-span-12 sm:col-span-3" value={l.serviceId ?? ""} onChange={(e) => pick(i, e.target.value)} aria-label="Leistung"><option value="">Freie Position</option>{cat?.services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <input className="input col-span-12 sm:col-span-4" placeholder="Beschreibung" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  <input className="input col-span-3 sm:col-span-1" inputMode="decimal" aria-label="Menge" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                  <input className="input col-span-3 sm:col-span-1" aria-label="Einheit" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                  <input className="input col-span-3 sm:col-span-2" inputMode="decimal" placeholder="Preis netto" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
                  <div className="col-span-3 flex gap-1 sm:col-span-1">
                    <select className="input px-1" aria-label="USt." value={l.taxRate} onChange={(e) => setLine(i, { taxRate: Number(e.target.value) })}><option value={19}>19</option><option value={7}>7</option><option value={0}>0</option></select>
                    {form.lines.length > 1 && <button type="button" className="btn-ghost p-1" aria-label="Position entfernen" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
              <button type="button" className="btn-ghost text-xs" onClick={() => setForm({ ...form, lines: [...form.lines, { description: "", qty: "1", unit: "Stück", price: "", taxRate: 19 }] })}><Plus className="h-3.5 w-3.5" />Position</button>
            </div>
            <textarea className="input min-h-[50px]" placeholder="Hinweis (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <p className="text-right text-sm text-zinc-300">Summe netto: <span className="font-mono">{euro(formTotal)}</span></p>
            {err && <p className="text-xs text-amber-400">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Abbrechen</button>
              <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Entwurf speichern</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Chip({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, "bg-zinc-500/15 text-zinc-300"];
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", tone)}>{label}</span>;
}
