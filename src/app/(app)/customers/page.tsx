"use client";

import { useEffect, useState } from "react";
import { Search, X, Loader2, Download, Trash2 } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { CUSTOMER_TYPES, type CustomerType } from "@/lib/constants";
import { fmtDateTime } from "@/lib/ui";
import { Panel, Skeleton, StatusChip, UrgencyChip } from "@/components/hub/Primitives";
import { apiDownload, apiFetch, useSession } from "@/components/session";

type Row = {
  id: string; name: string | null; companyName: string | null; phone: string; email: string | null;
  address: string | null; postalCode: string | null; customerType: string; status: string; updatedAt: string;
  _count: { tickets: number; calls: number }; tickets: { createdAt: string; category: string | null }[];
};
type Detail = Omit<Row, "tickets"> & { notes: string | null; tickets: { id: string; category: string | null; urgency: string; status: string; summary: string | null; createdAt: string }[] };

export default function CustomersPage() {
  const { me } = useSession();
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setD(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, reload } = usePoll<Row[]>(`/api/customers${d ? `?q=${encodeURIComponent(d)}` : ""}`, 15000);
  const typeLabel = (t: string) => me?.tenant?.customerTypeLabels[t as CustomerType] ?? t;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Kunden</h1>
        <p className="text-sm text-zinc-500">Werden automatisch über die Rufnummer erkannt und angelegt.</p>
      </header>
      <Panel
        title={<span className="text-sm text-zinc-400">{data ? `${data.length} Einträge` : "Lade…"}</span>}
        action={
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input className="input py-1.5 pl-8 text-xs" placeholder="Name, Nummer, PLZ…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3 font-medium">Kunde</th>
                <th className="py-2 pr-3 font-medium">Kontakt</th>
                <th className="py-2 pr-3 font-medium">Adresse</th>
                <th className="py-2 pr-3 font-medium">Typ</th>
                <th className="py-2 pr-3 font-medium">Vorgänge</th>
                <th className="py-2 font-medium">Letzter Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {!data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6} className="py-2"><Skeleton className="h-8" /></td></tr>)}
              {data?.map((c) => (
                <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer border-b border-zinc-800/60 transition hover:bg-zinc-800/30">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{c.companyName ?? c.name ?? "Unbekannt"}</span>
                      {c.status === "NEW" && <span className="chip border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Neu</span>}
                    </div>
                    {c.companyName && c.name && <div className="text-xs text-zinc-500">{c.name}</div>}
                  </td>
                  <td className="py-3 pr-3 text-zinc-300">
                    <div className="font-mono text-xs">{c.phone}</div>
                    <div className="text-xs text-zinc-500">{c.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-zinc-400">{[c.address, c.postalCode].filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-3 pr-3 text-xs text-zinc-400">{typeLabel(c.customerType)}</td>
                  <td className="py-3 pr-3 tabular-nums text-zinc-300">{c._count.tickets}</td>
                  <td className="py-3 text-xs text-zinc-500">{c.tickets[0] ? <>{fmtDateTime(c.tickets[0].createdAt)} · {c.tickets[0].category}</> : "—"}</td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Keine Kunden gefunden.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md animate-slidein">
        <header className="flex items-start justify-between border-b border-zinc-800 p-5">
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
            <section className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
              <button className="btn-ghost text-xs" onClick={() => apiDownload(`/api/customers/${id}/export`, `auskunft-${id}.json`).catch((e) => setMsg((e as Error).message))}><Download className="h-3.5 w-3.5" />Datenauskunft (DSGVO)</button>
              {isTenantAdmin && <button className="btn-ghost text-xs text-amber-300" onClick={erase}><Trash2 className="h-3.5 w-3.5" />Endgültig löschen</button>}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
