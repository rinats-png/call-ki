"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Bell, CalendarClock, CheckCircle2, ClipboardList, Download, FileText, ListTodo, Loader2, Mail, MapPin, Phone, PhoneCall, Wallet, Wrench } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { apiDownload, apiFetch, useSession } from "@/components/session";

type Item = { id: string; at: string; kind: "call" | "ticket" | "appointment" | "message" | "report" | "bill" | "payment" | "task"; title: string; detail?: string | null; tone?: "default" | "warn" | "good" | "muted"; ticketId?: string | null; href?: string | null; meta?: Record<string, string | number | boolean | null> };
type Customer = { id: string; name: string | null; companyName: string | null; phone: string; email: string | null; address: string | null; postalCode: string | null; customerType: string; status: string; notes: string | null; createdAt: string };
type Data = { customer: Customer; stats: { calls: number; tickets: number; openTickets: number; jobsDone: number; nextAppointment: { at: string; ticketId: string; employee: string | null } | null; firstContact: string; revenueCents?: number; openCents?: number }; items: Item[] };

const ICON = { call: PhoneCall, ticket: ClipboardList, appointment: CalendarClock, message: Bell, report: Wrench, bill: FileText, payment: Wallet, task: ListTodo };
const FILTERS: [string, string, Item["kind"][]][] = [["all", "Alles", []], ["calls", "Anrufe", ["call"]], ["jobs", "Vorgänge & Termine", ["ticket", "appointment", "report", "task"]], ["msg", "Nachrichten", ["message"]], ["money", "Rechnungen", ["bill", "payment"]]];
const eur = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Kundenakte: alles zu einem Kunden auf einer Seite – Anrufe, Vorgänge, Termine, Nachrichten, Berichte, Rechnungen, Aufgaben */
export default function CustomerFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useSession();
  const tz = me?.tenant?.timezone ?? "Europe/Berlin";
  const { data, reload } = usePoll<Data>(`/api/customers/${id}/timeline`, 30_000);
  const [filter, setFilter] = useState("all");
  const when = (s: string) => new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz });

  if (!data) return <div className="mx-auto max-w-[1300px]"><Skeleton className="h-96" /></div>;
  const c = data.customer;
  const kinds = FILTERS.find((f) => f[0] === filter)![2];
  const items = data.items.filter((i) => !kinds.length || kinds.includes(i.kind));
  const months = new Map<string, Item[]>();
  for (const i of items) {
    const k = new Date(i.at).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: tz });
    months.set(k, [...(months.get(k) ?? []), i]);
  }
  const addr = [c.address, c.postalCode && !(c.address ?? "").includes(c.postalCode) ? c.postalCode : null].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      <Link href="/customers" className="btn-ghost w-fit text-xs"><ArrowLeft className="h-3.5 w-3.5" />Alle Kunden</Link>
      <header className="glass flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs text-zinc-500">{me?.tenant?.customerTypeLabels[c.customerType as (typeof CUSTOMER_TYPES)[number]] ?? c.customerType} · Kunde seit {new Date(data.stats.firstContact).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: tz })}</p>
          <h1 className="text-2xl font-extrabold text-zinc-50">{c.companyName || c.name || c.phone}</h1>
          {c.companyName && c.name && <p className="text-sm text-zinc-400">{c.name}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-ghost text-xs" href={`tel:${c.phone}`}><Phone className="h-3.5 w-3.5" />{c.phone}</a>
            {c.email && <a className="btn-ghost text-xs" href={`mailto:${c.email}`}><Mail className="h-3.5 w-3.5" />{c.email}</a>}
            {addr && <a className="btn-ghost text-xs" target="_blank" rel="noreferrer noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}><MapPin className="h-3.5 w-3.5" />{addr}</a>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Stat k="Anrufe" v={data.stats.calls} />
          <Stat k="Vorgänge" v={`${data.stats.tickets}${data.stats.openTickets ? ` (${data.stats.openTickets} offen)` : ""}`} />
          {data.stats.revenueCents !== undefined ? <Stat k="Umsatz" v={eur(data.stats.revenueCents)} /> : <Stat k="Erledigt" v={data.stats.jobsDone} />}
          {data.stats.openCents ? <Stat k="Offen" v={eur(data.stats.openCents)} warn /> : <Stat k="Nächster Termin" v={data.stats.nextAppointment ? new Date(data.stats.nextAppointment.at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: tz }) : "–"} />}
        </dl>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Verlauf" action={
          <div className="flex flex-wrap gap-1">{FILTERS.map(([k, l]) => <button key={k} className={cn("rounded-md px-2 py-1 text-xs", filter === k ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-400 hover:text-zinc-200")} onClick={() => setFilter(k)}>{l}</button>)}</div>
        }>
          {items.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Noch nichts in diesem Bereich.</p> : [...months.entries()].map(([m, list]) => (
            <section key={m} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{m}</h3>
              <ol className="relative space-y-3 border-l border-zinc-800 pl-5">
                {list.map((i) => {
                  const Icon = ICON[i.kind];
                  const upcoming = i.kind === "appointment" && i.meta?.upcoming;
                  return (
                    <li key={i.id} className="relative">
                      <span className={cn("absolute -left-[31px] grid h-5 w-5 place-items-center rounded-full border bg-[rgb(var(--page))]", i.tone === "warn" ? "border-amber-500/60 text-amber-300" : i.tone === "good" ? "border-emerald-500/50 text-emerald-300" : "border-zinc-700 text-zinc-400")}><Icon className="h-3 w-3" /></span>
                      <div className={cn("text-sm", i.tone === "muted" ? "text-zinc-400" : "text-zinc-100")}>
                        <span className="font-medium">{i.title}</span>
                        {upcoming && <span className="ml-2 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[11px] text-emerald-300">bevorstehend</span>}
                        {i.kind === "ticket" && i.meta?.status === "PENDING" && <span className="ml-2 rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] text-amber-300">offen</span>}
                      </div>
                      <div className="text-xs text-zinc-500">{when(i.at)}{i.detail ? ` · ${i.detail}` : ""}</div>
                      <div className="mt-0.5 flex gap-3 text-xs">
                        {i.ticketId && <Link className="text-cyan-300 hover:underline" href={`/?ticket=${i.ticketId}`}>Vorgang öffnen</Link>}
                        {i.kind === "call" && i.meta?.recording && <a className="text-cyan-300 hover:underline" href={`/api/calls/${i.meta.callId}/recording`} target="_blank" rel="noreferrer">Aufnahme</a>}
                        {i.href && <Link className="text-cyan-300 hover:underline" href={i.href}>Zu den Rechnungen</Link>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </Panel>
        <div className="space-y-4">
          {data.stats.nextAppointment && (
            <Panel title="Nächster Termin">
              <p className="text-sm text-zinc-200">{new Date(data.stats.nextAppointment.at).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz })}{data.stats.nextAppointment.employee ? ` mit ${data.stats.nextAppointment.employee}` : ""}</p>
              <Link className="mt-1 inline-block text-xs text-cyan-300 hover:underline" href={`/?ticket=${data.stats.nextAppointment.ticketId}`}>Vorgang öffnen</Link>
            </Panel>
          )}
          <EditPanel c={c} onSaved={reload} />
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return <div className="glass-soft min-w-[110px] px-3 py-2"><dt className="text-[11px] text-zinc-500">{k}</dt><dd className={cn("text-base font-semibold", warn ? "text-amber-300" : "text-zinc-100")}>{v}</dd></div>;
}

function EditPanel({ c, onSaved }: { c: Customer; onSaved: () => void }) {
  const { me } = useSession();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setF({ name: c.name ?? "", companyName: c.companyName ?? "", email: c.email ?? "", address: c.address ?? "", postalCode: c.postalCode ?? "", customerType: c.customerType, notes: c.notes ?? "" }), [c]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true); setMsg(null);
    try {
      await apiFetch(`/api/customers/${c.id}`, { method: "PATCH", json: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === "customerType" ? v : v || null])) });
      setMsg("Gespeichert."); onSaved();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }
  return (
    <Panel title="Stammdaten & Notizen">
      <div className="space-y-2">
        <input className="input" placeholder="Name" value={f.name ?? ""} onChange={set("name")} />
        <input className="input" placeholder="Firma" value={f.companyName ?? ""} onChange={set("companyName")} />
        <input className="input" placeholder="E-Mail" value={f.email ?? ""} onChange={set("email")} />
        <div className="grid grid-cols-[1fr_90px] gap-2"><input className="input" placeholder="Straße, Ort" value={f.address ?? ""} onChange={set("address")} /><input className="input" placeholder="PLZ" value={f.postalCode ?? ""} onChange={set("postalCode")} /></div>
        <select className="input" value={f.customerType ?? "PRIVATE"} onChange={set("customerType")}>{CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{me?.tenant?.customerTypeLabels[t] ?? t}</option>)}</select>
        <textarea className="input min-h-[90px]" placeholder="Notizen (z. B. Zugang über Hof, Hund im Haus)" value={f.notes ?? ""} onChange={set("notes")} />
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-zinc-400">{msg}</span><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button></div>
        <button className="btn-ghost w-full justify-center text-xs" onClick={() => apiDownload(`/api/customers/${c.id}/export`, `auskunft-${c.id}.json`).catch((e) => setMsg((e as Error).message))}><Download className="h-3.5 w-3.5" />Datenauskunft (DSGVO)</button>
        <p className="flex items-center gap-1 text-[11px] text-zinc-500"><CheckCircle2 className="h-3 w-3" />Endgültig löschen: in der Kundenliste.</p>
      </div>
    </Panel>
  );
}
