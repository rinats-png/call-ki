"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, X, Loader2, Download, Trash2 } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { CUSTOMER_TYPES, type CustomerType } from "@/lib/constants";
import { cn, fmtDateTime } from "@/lib/ui";
import { PageHero } from "@/components/PageHero";
import { Skeleton, StatusChip, UrgencyChip } from "@/components/hub/Primitives";
import { apiDownload, apiFetch, useSession } from "@/components/session";

type Row = {
  id: string; name: string | null; companyName: string | null; phone: string; email: string | null;
  address: string | null; postalCode: string | null; customerType: string; status: string; updatedAt: string;
  _count: { tickets: number; calls: number }; tickets: { createdAt: string; category: string | null }[];
};
type Detail = Omit<Row, "tickets"> & { notes: string | null; tickets: { id: string; category: string | null; urgency: string; status: string; summary: string | null; createdAt: string }[] };

const TYPE_TONE: Record<string, string> = {
  PRIVATE: "bg-cyan-400/15 text-cyan-300",
  BUSINESS: "bg-emerald-400/15 text-emerald-300",
  PROPERTY_MANAGEMENT: "bg-amber-400/15 text-amber-300",
};
const initials = (s: string) => s.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function CustomersPage() {
  const { me } = useSession();
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  const [type, setType] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setD(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, reload } = usePoll<Row[]>(`/api/customers${d ? `?q=${encodeURIComponent(d)}` : ""}`, 15000);
  const { data: all } = usePoll<Row[]>("/api/customers", 60000);
  const typeLabel = (t: string) => me?.tenant?.customerTypeLabels[t as CustomerType] ?? t;
  const count = (f: (r: Row) => boolean) => all?.filter(f).length ?? "–";
  const rows = data?.filter((c) => !type || c.customerType === type);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow="Werden automatisch über die Rufnummer erkannt und angelegt"
        title="Kunden"
        value={all ? all.length : "–"}
        valueLabel={all && all.length >= 200 ? "neueste Einträge" : "Einträge"}
        stats={[
          { label: "Neu", value: count((r) => r.status === "NEW") },
          { label: typeLabel("BUSINESS"), value: count((r) => r.customerType === "BUSINESS") },
          { label: typeLabel("PROPERTY_MANAGEMENT"), value: count((r) => r.customerType === "PROPERTY_MANAGEMENT") },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex gap-1 overflow-x-auto rounded-full p-1">
          {["", ...CUSTOMER_TYPES].map((t) => (
            <button key={t || "all"} type="button" onClick={() => setType(t)} aria-pressed={type === t} className={cn("nav-item py-1.5", type === t && "nav-item-active")}>
              {t ? typeLabel(t) : "Alle"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input className="input rounded-full pl-10" placeholder="Name, Nummer, PLZ…" aria-label="Kunden durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <section className="glass p-2 md:p-3">
        <div className="hidden grid-cols-[44px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_90px_minmax(0,1.4fr)] gap-4 px-4 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 lg:grid">
          <span /><span>Kunde</span><span>Kontakt</span><span>Adresse</span><span className="text-center">Vorgänge</span><span>Letzter Kontakt</span>
        </div>
        <ul className="space-y-1.5">
          {!rows && Array.from({ length: 6 }).map((_, i) => <li key={i}><Skeleton className="h-16 rounded-2xl" /></li>)}
          {rows?.map((c) => {
            const name = c.companyName ?? c.name ?? "Unbekannt";
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setOpen(c.id)} className="glass-soft grid w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-3 text-left transition hover:bg-zinc-800/70 lg:grid-cols-[44px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_90px_minmax(0,1.4fr)] lg:gap-4 lg:px-4">
                  <span className={cn("row-span-3 grid h-11 w-11 place-items-center rounded-full text-sm font-bold lg:row-span-1", TYPE_TONE[c.customerType] ?? TYPE_TONE.PRIVATE)}>{initials(name)}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold text-zinc-50">{name}</span>
                      {c.status === "NEW" && <span className="chip border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Neu</span>}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">{c.companyName && c.name ? `${c.name} · ` : ""}{typeLabel(c.customerType)}</span>
                  </span>
                  <span className="min-w-0 text-xs">
                    <span className="block font-mono text-zinc-200">{c.phone}</span>
                    <span className="block truncate text-zinc-500">{c.email ?? "keine E-Mail"}</span>
                  </span>
                  <span className="min-w-0 truncate text-xs text-zinc-400">{[c.address, c.postalCode].filter(Boolean).join(", ") || "—"}</span>
                  <span className="hidden justify-center lg:flex">
                    <span className="grid h-8 min-w-8 place-items-center rounded-full bg-zinc-800 px-2 text-sm font-bold tabular-nums text-zinc-100">{c._count.tickets}</span>
                  </span>
                  <span className="min-w-0 truncate text-xs text-zinc-500">
                    {c.tickets[0] ? <><span className="text-zinc-300">{c.tickets[0].category}</span> · {fmtDateTime(c.tickets[0].createdAt)}</> : "—"}
                    <span className="lg:hidden"> · {c._count.tickets} Vorgänge</span>
                  </span>
                </button>
              </li>
            );
          })}
          {rows?.length === 0 && <li className="py-12 text-center text-sm text-zinc-500">Keine Kunden gefunden.</li>}
        </ul>
      </section>
      {open && <CustomerDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

function CustomerDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { me, isTenantAdmin } = useSession();
  const [c, setC] = useState<Detail | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Detail>(`/api/customers/${id}`).then((r) => {
      setC(r);
      setF({ name: r.name ?? "", companyName: r.companyName ?? "", email: r.email ?? "", address: r.address ?? "", postalCode: r.postalCode ?? "", customerType: r.customerType, notes: r.notes ?? "" });
    });
  }, [id]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/api/customers/${id}`, { method: "PATCH", json: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === "customerType" ? v : v || null])) });
      setMsg("Gespeichert.");
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  async function erase() {
    if (!confirm("Kunde mit allen Vorgängen, Anrufen und Nachrichten endgültig löschen (DSGVO)? Das kann nicht rückgängig gemacht werden.")) return;
    try {
      await apiFetch(`/api/customers/${id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 !m-0 flex justify-end p-0 sm:p-3">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none !bg-[rgb(var(--page)/0.96)] animate-slidein sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 p-5">
          {c ? <div><h3 className="text-lg font-semibold text-zinc-50">{c.companyName ?? c.name ?? c.phone}</h3><p className="font-mono text-xs text-zinc-500">{c.phone}</p></div> : <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>
        {c && (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <section className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Name" value={f.name} onChange={set("name")} />
              <input className="input" placeholder="Firma" value={f.companyName} onChange={set("companyName")} />
              <input className="input col-span-2" placeholder="E-Mail" value={f.email} onChange={set("email")} />
              <input className="input" placeholder="Straße, Ort" value={f.address} onChange={set("address")} />
              <input className="input" placeholder="PLZ" value={f.postalCode} onChange={set("postalCode")} />
              <select className="input col-span-2" value={f.customerType} onChange={set("customerType")}>
                {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{me?.tenant?.customerTypeLabels[t] ?? t}</option>)}
              </select>
              <textarea className="input col-span-2 min-h-[72px]" placeholder="Notizen (z. B. Zugang über Hof, Hund im Haus)" value={f.notes} onChange={set("notes")} />
              <div className="col-span-2 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">{msg}</span>
                <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button>
              </div>
            </section>
            <Link href={`/customers/${id}`} className="btn-primary w-full justify-center">Kundenakte öffnen – alles auf einen Blick</Link>
            <section>
              <h4 className="label mb-2">Vorgänge</h4>
              {c.tickets.length === 0 && <p className="text-sm text-zinc-500">Keine Vorgänge.</p>}
              {c.tickets.map((t) => (
                <div key={t.id} className="glass-soft mb-2 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-zinc-200">{t.category} <span className="text-xs text-zinc-500">· {fmtDateTime(t.createdAt)}</span></span>
                    <span className="flex gap-1.5"><UrgencyChip urgency={t.urgency} /><StatusChip status={t.status} /></span>
                  </div>
                  {t.summary && <p className="mt-1 text-xs text-zinc-400">{t.summary}</p>}
                </div>
              ))}
            </section>
            <section className="flex flex-wrap gap-2 border-t border-zinc-700/60 pt-4">
              <button className="btn-ghost text-xs" onClick={() => apiDownload(`/api/customers/${id}/export`, `auskunft-${id}.json`).catch((e) => setMsg((e as Error).message))}><Download className="h-3.5 w-3.5" />Datenauskunft (DSGVO)</button>
              {isTenantAdmin && <button className="btn-ghost text-xs text-rose-400" onClick={erase}><Trash2 className="h-3.5 w-3.5" />Endgültig löschen</button>}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
