"use client";

import Link from "next/link";
import { useState } from "react";
import { Car, Check, ChevronLeft, ChevronRight, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { PageHero } from "@/components/PageHero";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { ModuleGate } from "@/components/ModuleGate";
import { apiFetch, useSession } from "@/components/session";

type Cust = { name: string | null; companyName: string | null; phone: string; address?: string | null; postalCode?: string | null };
type Appt = { id: string; appointmentStart: string; appointmentEnd: string; category: string | null; urgency: string; status: string; summary: string | null; confirmation: string | null; assignedEmployee: { name: string } | null; service: { name: string } | null; customer: Cust };
type Callback = { id: string; category: string | null; urgency: string; status: string; summary: string | null; createdAt: string; assignedEmployee: { name: string } | null; customer: Cust };
type Task = { id: string; title: string; note: string; dueAt: string | null; doneAt: string | null; assigneeId: string | null; ticketId: string | null; assignee: { name: string | null; email: string } | null };
type Data = { date: string; employee: { id: string; name: string } | null; appointments: Appt[]; legs: Record<string, { minutes: number; km: number }>; callbacks: Callback[]; tasks: Task[]; users: { id: string; name: string | null; email: string }[]; me: string };

const who = (c: Cust) => c.companyName || c.name || c.phone;
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const shift = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ago = (s: string) => { const h = Math.round((Date.now() - Date.parse(s)) / 3600_000); return h < 1 ? "gerade eben" : h < 24 ? `vor ${h} Std.` : `vor ${Math.round(h / 24)} Tg.`; };

export default function TodayPage() {
  return <ModuleGate module="planning"><Today /></ModuleGate>;
}

function Today() {
  const { me } = useSession();
  const tz = me?.tenant?.timezone ?? "Europe/Berlin";
  const [date, setDate] = useState(ymd(new Date()));
  const { data, reload } = usePoll<Data>(`/api/today?date=${date}`, 60_000);
  const t = (s: string) => new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const isToday = date === ymd(new Date());
  const open = data?.tasks.filter((x) => !x.doneAt) ?? [];
  const hello = new Date().getHours() < 11 ? "Guten Morgen" : new Date().getHours() < 17 ? "Guten Tag" : "Guten Abend";

  async function closeCallback(id: string) {
    if (!confirm("Rückruf als erledigt markieren?")) return;
    await apiFetch(`/api/tickets/${id}`, { method: "PATCH", json: { status: "CLOSED" } });
    reload();
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageHero
        eyebrow={data?.employee ? `${hello}, ${data.employee.name.split(" ")[0]}` : hello}
        title={isToday ? "Mein Tag" : new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" })}
        value={data?.appointments.length ?? "–"}
        valueLabel="Termine"
        stats={[{ label: "Rückrufe offen", value: data?.callbacks.length ?? "–" }, { label: "Aufgaben offen", value: open.length }]}
        action={<div className="flex gap-1"><button className="btn-ghost p-2" aria-label="Vorheriger Tag" onClick={() => setDate(shift(date, -1))}><ChevronLeft className="h-4 w-4" /></button><button className="btn-ghost text-xs" onClick={() => setDate(ymd(new Date()))}>Heute</button><button className="btn-ghost p-2" aria-label="Nächster Tag" onClick={() => setDate(shift(date, 1))}><ChevronRight className="h-4 w-4" /></button></div>}
      />
      {!data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title={data.employee ? "Meine Termine" : "Termine des Teams"}>
            {!data.employee && <p className="mb-2 text-xs text-zinc-500">Tipp: Hat ein Mitarbeiter im Team dieselbe E-Mail-Adresse wie Ihr Zugang, sehen Sie hier nur Ihre eigenen Termine mit Fahrzeiten.</p>}
            {data.appointments.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">Keine Termine.</p> : (
              <ol className="space-y-2">
                {data.appointments.map((a) => (
                  <li key={a.id}>
                    {data.legs[a.id] && <div className="mb-1 flex items-center gap-1 pl-2 text-[11px] text-zinc-500"><Car className="h-3 w-3" />{data.legs[a.id].minutes} Min · {data.legs[a.id].km.toLocaleString("de-DE")} km</div>}
                    <div className={cn("rounded-lg border p-3 text-sm", a.urgency === "CRITICAL" || a.urgency === "HIGH" ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800 bg-white/[0.02]", a.status === "CLOSED" && "opacity-50")}>
                      <div className="flex items-center justify-between"><span className="font-mono text-zinc-200">{t(a.appointmentStart)}–{t(a.appointmentEnd)}</span>{a.confirmation === "CONFIRMED" ? <span className="text-[11px] text-emerald-300">bestätigt</span> : a.confirmation === "DECLINED" ? <span className="text-[11px] text-amber-300">passt nicht</span> : null}</div>
                      <Link href={`/?ticket=${a.id}`} className="font-semibold text-zinc-100 hover:underline">{a.service?.name ?? a.category ?? "Termin"}</Link>
                      <div className="text-zinc-400">{who(a.customer)}{!data.employee && a.assignedEmployee ? ` · ${a.assignedEmployee.name}` : ""}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <a className="btn-ghost px-2 py-1 text-xs" href={`tel:${a.customer.phone}`}><Phone className="h-3.5 w-3.5" />Anrufen</a>
                        {(a.customer.address || a.customer.postalCode) && <a className="btn-ghost px-2 py-1 text-xs" target="_blank" rel="noreferrer noopener" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([a.customer.address, a.customer.postalCode].filter(Boolean).join(", "))}`}><MapPin className="h-3.5 w-3.5" />Route</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Rückrufe">
            {data.callbacks.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">Keine offenen Rückrufe.</p> : (
              <ul className="space-y-2">
                {data.callbacks.map((c) => (
                  <li key={c.id} className={cn("rounded-lg border p-3 text-sm", c.urgency === "CRITICAL" || c.urgency === "HIGH" ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800 bg-white/[0.02]")}>
                    <div className="flex items-center justify-between gap-2"><Link href={`/?ticket=${c.id}`} className="font-semibold text-zinc-100 hover:underline">{who(c.customer)}</Link><span className="text-[11px] text-zinc-500">{ago(c.createdAt)}</span></div>
                    <div className="text-zinc-400">{c.category ?? "Anliegen"}{c.summary ? ` – ${c.summary.slice(0, 120)}` : ""}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a className="btn-ghost px-2 py-1 text-xs" href={`tel:${c.customer.phone}`}><Phone className="h-3.5 w-3.5" />{c.customer.phone}</a>
                      <Link className="btn-ghost px-2 py-1 text-xs" href="/planning">Termin vergeben</Link>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => closeCallback(c.id)}><Check className="h-3.5 w-3.5" />Erledigt</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <TasksPanel data={data} date={date} onChanged={reload} tz={tz} />
        </div>
      )}
    </div>
  );
}

function TasksPanel({ data, date, onChanged, tz }: { data: Data; date: string; onChanged: () => void; tz: string }) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(data.me);
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await apiFetch("/api/tasks", { method: "POST", json: { title, assigneeId: assigneeId || null, dueAt: new Date(`${date}T16:00:00Z`).toISOString() } });
      setTitle(""); onChanged();
    } finally { setBusy(false); }
  }
  const toggle = async (t: Task) => { await apiFetch(`/api/tasks/${t.id}`, { method: "PATCH", json: { done: !t.doneAt } }); onChanged(); };
  const remove = async (t: Task) => { await apiFetch(`/api/tasks/${t.id}`, { method: "DELETE" }); onChanged(); };
  const overdue = (t: Task) => !t.doneAt && t.dueAt && Date.parse(t.dueAt) < Date.parse(`${date}T00:00:00Z`);
  return (
    <Panel title="Aufgaben">
      <form onSubmit={add} className="mb-3 space-y-2">
        <input className="input" placeholder="Neue Aufgabe, z. B. Material bestellen" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Für wen">
            <option value={data.me}>für mich</option>
            <option value="">für alle</option>
            {data.users.filter((u) => u.id !== data.me).map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
          <button className="btn-primary shrink-0" disabled={busy || !title.trim()}><Plus className="h-4 w-4" />Hinzufügen</button>
        </div>
      </form>
      {data.tasks.length === 0 ? <p className="py-4 text-center text-sm text-zinc-500">Nichts zu tun – oder noch nichts eingetragen.</p> : (
        <ul className="space-y-1.5">
          {data.tasks.map((t) => (
            <li key={t.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
              <input type="checkbox" className="mt-1" checked={!!t.doneAt} onChange={() => toggle(t)} aria-label={`${t.title} erledigt`} />
              <div className="min-w-0 flex-1">
                <div className={cn("text-zinc-100", t.doneAt && "text-zinc-500 line-through")}>{t.title}</div>
                <div className="text-[11px] text-zinc-500">
                  {t.assignee ? (t.assigneeId === data.me ? "ich" : t.assignee.name || t.assignee.email) : "alle"}
                  {overdue(t) && <span className="ml-1 text-amber-300">· überfällig seit {new Date(t.dueAt!).toLocaleDateString("de-DE", { timeZone: tz })}</span>}
                  {t.ticketId && <> · <Link className="underline" href={`/?ticket=${t.ticketId}`}>Vorgang</Link></>}
                </div>
              </div>
              <button className="btn-ghost p-1 opacity-0 group-hover:opacity-100" aria-label="Aufgabe löschen" onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
