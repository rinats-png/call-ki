"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Car, ChevronLeft, ChevronRight, GripVertical, Loader2, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import { fromZoned, zonedParts } from "@/lib/time";
import { PageHero } from "@/components/PageHero";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { ModuleGate } from "@/components/ModuleGate";
import { apiFetch } from "@/components/session";

type View = "day" | "week" | "month";
type Cust = { name: string | null; companyName: string | null; address?: string | null; postalCode: string | null; phone: string };
type Appt = { ticketId: string; employeeId: string | null; start: string; end: string; day: string; category: string | null; service: string | null; urgency: string; status: string; confirmation: string | null; jobStatus: string | null; customer: Cust };
type Leg = { employeeId: string; day: string; fromTicketId: string | null; toTicketId: string | null; minutes: number; km: number; estimated: boolean; tight: boolean };
type Totals = { employeeId: string; day: string; appointments: number; workMin: number; driveMin: number; km: number };
type Unplanned = { ticketId: string; category: string | null; urgency: string; createdAt: string; summary: string; employeeId: string | null; durationMin: number; service: string | null; customer: Cust };
type Data = { view: View; date: string; days: string[]; timezone: string; businessHours: { start: string; end: string; days: number[] }; employees: { id: string; name: string; role: string }[]; appointments: Appt[]; legs: Leg[]; totals: Totals[]; unplanned: Unplanned[] };
type Move = { ticketId: string; title: string; employeeId: string; employeeName: string; start: Date; isNew: boolean };

const PX = 1.1; // Pixel je Minute in der Tagesansicht
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const who = (c: Cust) => c.companyName || c.name || c.phone;
const hrs = (min: number) => `${(Math.round(min / 6) / 10).toLocaleString("de-DE")} h`;
const today = () => new Date().toISOString().slice(0, 10);
function shift(date: string, view: View, dir: number) {
  const d = new Date(`${date}T12:00:00Z`);
  if (view === "day") d.setUTCDate(d.getUTCDate() + dir);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + 7 * dir);
  else d.setUTCMonth(d.getUTCMonth() + dir, 1);
  return d.toISOString().slice(0, 10);
}
const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" }) => new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", { ...opts, timeZone: "UTC" });

export default function PlanningPage() {
  return <ModuleGate module="planning"><Planning /></ModuleGate>;
}

function Planning() {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(today());
  const { data, reload } = usePoll<Data>(`/api/planning?view=${view}&date=${date}`, 60_000);
  const [move, setMove] = useState<Move | null>(null);

  const sum = useMemo(() => data?.totals.reduce((s, t) => ({ n: s.n + t.appointments, km: s.km + t.km, drive: s.drive + t.driveMin }), { n: 0, km: 0, drive: 0 }), [data]);
  const title = view === "day" ? dayLabel(date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : view === "week" && data ? `${dayLabel(data.days[0])} – ${dayLabel(data.days[6])}` : new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

  /** Ablegen: Zeit aus Tag + Minuten in der Zeitzone des Betriebs */
  function drop(ticketId: string, employeeId: string, day: string, minutes: number) {
    if (!data) return;
    const a = data.appointments.find((x) => x.ticketId === ticketId);
    const u = data.unplanned.find((x) => x.ticketId === ticketId);
    const [y, m, d] = day.split("-").map(Number);
    const start = fromZoned(y, m, d, Math.floor(minutes / 60), minutes % 60, data.timezone);
    const emp = data.employees.find((e) => e.id === employeeId);
    const c = a?.customer ?? u?.customer;
    setMove({ ticketId, employeeId, employeeName: emp?.name ?? "", start, isNew: !a, title: `${a?.service ?? a?.category ?? u?.service ?? u?.category ?? "Vorgang"} – ${c ? who(c) : ""}` });
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <PageHero
        eyebrow="Termine, Fahrzeiten und freie Lücken des Teams"
        title="Teamkalender"
        value={sum?.n ?? "–"}
        valueLabel="Termine"
        stats={view === "month" ? [] : [{ label: "Fahrstrecke", value: sum ? `${Math.round(sum.km)} km` : "–" }, { label: "Fahrzeit", value: sum ? hrs(sum.drive) : "–" }]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex rounded-full p-1">
          {(["day", "week", "month"] as View[]).map((v) => <button key={v} className={cn("nav-item py-1.5 text-xs", view === v && "nav-item-active")} onClick={() => setView(v)}>{{ day: "Tag", week: "Woche", month: "Monat" }[v]}</button>)}
        </div>
        <button className="btn-ghost p-2" aria-label="Zurück" onClick={() => setDate(shift(date, view, -1))}><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn-ghost text-xs" onClick={() => setDate(today())}>Heute</button>
        <button className="btn-ghost p-2" aria-label="Weiter" onClick={() => setDate(shift(date, view, 1))}><ChevronRight className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
      </div>

      {!data ? <Skeleton className="h-[520px]" /> : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            {view === "day" && <DayView data={data} onDrop={drop} />}
            {view === "week" && <WeekView data={data} onDrop={drop} />}
            {view === "month" && <MonthView data={data} onPick={(d) => { setDate(d); setView("day"); }} />}
          </div>
          <UnplannedList items={data.unplanned} />
        </div>
      )}
      {move && <MoveDialog move={move} onClose={() => setMove(null)} onDone={() => { setMove(null); reload(); }} tz={data?.timezone ?? "Europe/Berlin"} />}
    </div>
  );
}

function Card({ a, compact, tz }: { a: Appt; compact?: boolean; tz: string }) {
  const done = a.jobStatus === "DONE" || a.status === "CLOSED";
  const t = (s: string) => new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return (
    <div
      draggable={!done}
      onDragStart={(e) => { e.dataTransfer.setData("text/ticket", a.ticketId); e.dataTransfer.effectAllowed = "move"; }}
      className={cn("group h-full overflow-hidden rounded-lg border px-2 py-1 text-xs leading-tight", done ? "border-zinc-700 bg-zinc-800/60 text-zinc-400" : a.urgency === "CRITICAL" ? "border-red-500/50 bg-red-500/15 text-zinc-100" : a.urgency === "HIGH" ? "border-amber-500/40 bg-amber-500/10 text-zinc-100" : "border-cyan-500/30 bg-cyan-500/10 text-zinc-100", !done && "cursor-grab active:cursor-grabbing")}
      title={`${who(a.customer)}${a.customer.address ? ` · ${a.customer.address}` : ""}`}
    >
      <div className="flex items-center gap-1">
        {!done && <GripVertical className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-80" />}
        <span className="font-mono">{t(a.start)}</span>
        {a.confirmation === "CONFIRMED" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="vom Kunden bestätigt" />}
        {a.confirmation === "DECLINED" && <AlertTriangle className="h-3 w-3 text-amber-300" aria-label="passt nicht" />}
      </div>
      <Link href={`/?ticket=${a.ticketId}`} className="block truncate font-semibold hover:underline">{a.service ?? a.category ?? "Termin"}</Link>
      {!compact && <div className="truncate text-zinc-400">{who(a.customer)}{a.customer.postalCode ? ` · ${a.customer.postalCode}` : ""}</div>}
    </div>
  );
}

function DayView({ data, onDrop }: { data: Data; onDrop: (ticketId: string, employeeId: string, day: string, minutes: number) => void }) {
  const day = data.days[0];
  const bhStart = toMin(data.businessHours.start), bhEnd = toMin(data.businessHours.end);
  const gridStart = Math.max(0, Math.floor(bhStart / 60) * 60 - 60), gridEnd = Math.min(24 * 60, Math.ceil(bhEnd / 60) * 60 + 60);
  const height = (gridEnd - gridStart) * PX;
  const minOf = (iso: string) => { const p = zonedParts(new Date(iso), data.timezone); return p.hour * 60 + p.minute; };
  const [over, setOver] = useState<string | null>(null);
  if (!data.employees.length) return <Panel><p className="py-8 text-center text-sm text-zinc-500">Noch keine Mitarbeiter angelegt (Team).</p></Panel>;
  return (
    <div className="glass overflow-x-auto p-3">
      <div className="flex min-w-max">
        <div className="w-12 shrink-0 pt-12">
          <div className="relative" style={{ height }}>
            {Array.from({ length: (gridEnd - gridStart) / 60 + 1 }, (_, i) => <span key={i} className="absolute -translate-y-1/2 text-[10px] text-zinc-500" style={{ top: i * 60 * PX }}>{String(gridStart / 60 + i).padStart(2, "0")}:00</span>)}
          </div>
        </div>
        {data.employees.map((e) => {
          const appts = data.appointments.filter((a) => a.employeeId === e.id);
          const legs = data.legs.filter((l) => l.employeeId === e.id);
          const tot = data.totals.find((t) => t.employeeId === e.id);
          // freie Lücken ≥ 60 Min. innerhalb der Arbeitszeit (Termine + Fahrten belegt)
          const busy = appts.map((a) => [minOf(a.start) - (legs.find((l) => l.toTicketId === a.ticketId)?.minutes ?? 0), minOf(a.end)] as const).sort((x, y) => x[0] - y[0]);
          const gaps: [number, number][] = [];
          let cur = bhStart;
          for (const [s, en] of busy) { if (s - cur >= 60) gaps.push([cur, s]); cur = Math.max(cur, en); }
          if (bhEnd - cur >= 60) gaps.push([cur, bhEnd]);
          return (
            <div key={e.id} className="w-52 shrink-0 border-l border-zinc-800 px-1.5">
              <div className="h-12 px-1">
                <div className="truncate text-sm font-semibold text-zinc-100">{e.name}</div>
                <div className="text-[11px] text-zinc-500">{tot ? `${tot.appointments} · ${hrs(tot.workMin)} · ${Math.round(tot.km)} km` : "frei"}</div>
              </div>
              <div
                className={cn("relative rounded-lg", over === e.id && "bg-cyan-400/5 ring-1 ring-cyan-400/40")}
                style={{ height }}
                onDragOver={(ev) => { ev.preventDefault(); setOver(e.id); }}
                onDragLeave={() => setOver(null)}
                onDrop={(ev) => {
                  ev.preventDefault(); setOver(null);
                  const id = ev.dataTransfer.getData("text/ticket");
                  const y = ev.clientY - (ev.currentTarget as HTMLElement).getBoundingClientRect().top;
                  const m = Math.round((gridStart + y / PX) / 15) * 15;
                  if (id) onDrop(id, e.id, day, Math.max(0, Math.min(m, 23 * 60 + 45)));
                }}
              >
                {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-zinc-800/70" style={{ top: i * 60 * PX }} />)}
                <div className="absolute inset-x-0 bg-white/[0.02]" style={{ top: (bhStart - gridStart) * PX, height: (bhEnd - bhStart) * PX }} />
                {gaps.map(([s, en]) => <div key={s} className="absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed border-emerald-500/20 text-[10px] text-emerald-400/70" style={{ top: (s - gridStart) * PX + 2, height: (en - s) * PX - 4 }}>frei {hrs(en - s)}</div>)}
                {legs.filter((l) => l.toTicketId).map((l) => {
                  const to = appts.find((a) => a.ticketId === l.toTicketId)!;
                  const top = (minOf(to.start) - l.minutes - gridStart) * PX;
                  return <div key={`${l.fromTicketId}-${l.toTicketId}`} className={cn("absolute inset-x-3 flex items-center justify-center gap-1 rounded text-[10px]", l.tight ? "bg-red-500/20 text-red-200" : "bg-zinc-700/30 text-zinc-400")} style={{ top, height: Math.max(l.minutes * PX, 14) }} title={l.estimated ? "geschätzt (Luftlinie)" : "laut Routenplaner"}><Car className="h-3 w-3" />{l.minutes} Min · {l.km.toLocaleString("de-DE")} km{l.tight ? " – zu knapp" : ""}</div>;
                })}
                {appts.map((a) => <div key={a.ticketId} className="absolute inset-x-1" style={{ top: (minOf(a.start) - gridStart) * PX, height: Math.max((Date.parse(a.end) - Date.parse(a.start)) / 60000 * PX, 26) }}><Card a={a} tz={data.timezone} /></div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ data, onDrop }: { data: Data; onDrop: (ticketId: string, employeeId: string, day: string, minutes: number) => void }) {
  const bhStart = toMin(data.businessHours.start), bhEnd = toMin(data.businessHours.end);
  const minOf = (iso: string) => { const p = zonedParts(new Date(iso), data.timezone); return p.hour * 60 + p.minute; };
  return (
    <div className="glass overflow-x-auto p-3">
      <table className="w-full min-w-[900px] table-fixed text-sm">
        <thead><tr><th className="w-36" />{data.days.map((d) => <th key={d} className="px-1 pb-2 text-left text-xs font-semibold text-zinc-400">{dayLabel(d)}</th>)}</tr></thead>
        <tbody>
          {data.employees.map((e) => (
            <tr key={e.id} className="border-t border-zinc-800 align-top">
              <td className="py-2 pr-2 font-semibold text-zinc-100">{e.name}</td>
              {data.days.map((d) => {
                const appts = data.appointments.filter((a) => a.employeeId === e.id && a.day === d);
                const t = data.totals.find((x) => x.employeeId === e.id && x.day === d);
                const free = Math.max(0, bhEnd - bhStart - (t?.workMin ?? 0) - (t?.driveMin ?? 0));
                return (
                  <td key={d} className="px-1 py-2" onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => {
                    ev.preventDefault();
                    const id = ev.dataTransfer.getData("text/ticket");
                    const a = data.appointments.find((x) => x.ticketId === id);
                    if (id) onDrop(id, e.id, d, a ? minOf(a.start) : bhStart);
                  }}>
                    <div className="min-h-16 space-y-1 rounded-lg p-0.5 hover:bg-white/[0.03]">
                      {appts.map((a) => <div key={a.ticketId} className="h-11"><Card a={a} compact tz={data.timezone} /></div>)}
                      <div className="text-[10px] text-zinc-500">{t ? `${hrs(t.workMin)} · ${Math.round(t.km)} km · ` : ""}{free >= 60 ? <span className="text-emerald-400/80">frei {hrs(free)}</span> : <span className="text-amber-300/80">voll</span>}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-500">Ziehen Sie einen Termin auf einen anderen Tag oder Mitarbeiter – die Uhrzeit bleibt, im Dialog können Sie sie anpassen.</p>
    </div>
  );
}

function MonthView({ data, onPick }: { data: Data; onPick: (day: string) => void }) {
  const first = new Date(`${data.days[0]}T12:00:00Z`).getUTCDay() || 7;
  const cells = [...Array(first - 1).fill(null), ...data.days];
  const bh = toMin(data.businessHours.end) - toMin(data.businessHours.start);
  const capacity = Math.max(1, data.employees.length) * bh;
  return (
    <div className="glass p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`x${i}`} />;
          const t = data.totals.filter((x) => x.day === d);
          const n = t.reduce((s, x) => s + x.appointments, 0);
          const load = Math.min(1, t.reduce((s, x) => s + x.workMin, 0) / capacity);
          return (
            <button key={d} onClick={() => onPick(d)} className={cn("flex h-20 flex-col rounded-lg border border-zinc-800 p-1.5 text-left hover:border-cyan-400/40", d === today() && "border-cyan-400/60")}>
              <span className="text-xs text-zinc-400">{Number(d.slice(8))}.</span>
              {n > 0 && <span className="mt-auto text-sm font-semibold text-zinc-100">{n} Termin{n === 1 ? "" : "e"}</span>}
              <span className="mt-1 h-1 w-full overflow-hidden rounded bg-zinc-800"><span className={cn("block h-full", load > 0.85 ? "bg-amber-400" : "bg-cyan-400")} style={{ width: `${load * 100}%` }} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnplannedList({ items }: { items: Unplanned[] }) {
  return (
    <Panel title="Ohne Termin">
      {items.length === 0 ? <p className="text-sm text-zinc-500">Alles eingeplant.</p> : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.ticketId} draggable onDragStart={(e) => { e.dataTransfer.setData("text/ticket", u.ticketId); }} className={cn("cursor-grab rounded-lg border p-2 text-xs", u.urgency === "CRITICAL" || u.urgency === "HIGH" ? "border-amber-500/40 bg-amber-500/10" : "border-zinc-700 bg-white/[0.03]")}>
              <div className="flex items-center gap-1 font-semibold text-zinc-100"><GripVertical className="h-3 w-3 opacity-50" />{u.service ?? u.category ?? "Vorgang"}</div>
              <div className="text-zinc-400">{who(u.customer)}{u.customer.postalCode ? ` · ${u.customer.postalCode}` : ""} · {u.durationMin} Min.</div>
              {u.summary && <div className="mt-0.5 line-clamp-2 text-zinc-500">{u.summary}</div>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">In den Kalender ziehen, um einen Termin zu vergeben.</p>
    </Panel>
  );
}

function MoveDialog({ move, onClose, onDone, tz }: { move: Move; onClose: () => void; onDone: () => void; tz: string }) {
  const p = zonedParts(move.start, tz);
  const [time, setTime] = useState(`${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    const [h, m] = time.split(":").map(Number);
    const start = fromZoned(p.year, p.month, p.day, h, m, tz);
    try {
      await apiFetch(`/api/planning/appointments/${move.ticketId}`, { method: "PATCH", json: { employeeId: move.employeeId, start: start.toISOString(), notifyCustomer: notify } });
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-md space-y-3 p-5 animate-fadein">
        <header className="flex items-center justify-between"><h3 className="font-semibold text-zinc-100">{move.isNew ? "Termin einplanen" : "Termin verschieben"}</h3><button className="btn-ghost p-2" onClick={onClose} aria-label="Schließen"><X className="h-4 w-4" /></button></header>
        <p className="text-sm text-zinc-300">{move.title}</p>
        <p className="text-sm text-zinc-400">{move.start.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: tz })} bei <b className="text-zinc-200">{move.employeeName}</b></p>
        <label className="block text-xs text-zinc-400">Uhrzeit<input type="time" step={900} className="input mt-1" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Kunden über den {move.isNew ? "Termin" : "neuen Termin"} informieren</label>
        <p className="text-xs text-zinc-500">Der Mitarbeiter bekommt den Termin in jedem Fall (E-Mail bzw. Kalender).</p>
        {err && <p className="text-sm text-amber-400">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Abbrechen</button><button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button></div>
      </div>
    </div>
  );
}
