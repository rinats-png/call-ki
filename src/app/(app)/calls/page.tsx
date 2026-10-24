"use client";

import { useState } from "react";
import { PhoneIncoming, PhoneCall, Voicemail, PhoneOff, PhoneForwarded, Loader2, X, Mic } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, fmtDateTime, fmtDuration } from "@/lib/ui";
import { PageHero } from "@/components/PageHero";
import { LiveDot, Skeleton, UrgencyChip, StatusChip } from "@/components/hub/Primitives";
import { Transcript } from "@/components/hub/TicketDrawer";
import { WaveformPlayer } from "@/components/WaveformPlayer";

type CallRow = {
  id: string; fromNumber: string; status: string; startedAt: string; durationSec: number | null; summary: string | null; endReason: string | null; recordingUrl: string | null;
  customer: { id: string; name: string | null; companyName: string | null } | null;
  tickets: { id: string; category: string | null; urgency: string; status: string }[];
};
type CallDetail = CallRow & { transcript: string | null; tickets: (CallRow["tickets"][number] & { summary: string | null })[] };

const STATUS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  RINGING: { label: "Klingelt", icon: PhoneIncoming, tone: "bg-cyan-400/15 text-cyan-300" },
  IN_PROGRESS: { label: "Läuft", icon: PhoneCall, tone: "bg-emerald-400/15 text-emerald-300" },
  ENDED: { label: "Beendet", icon: PhoneIncoming, tone: "bg-zinc-800 text-zinc-300" },
  FAILED: { label: "Fehler", icon: PhoneOff, tone: "bg-rose-400/15 text-rose-400" },
  FALLBACK: { label: "Weitergeleitet", icon: PhoneForwarded, tone: "bg-amber-400/15 text-amber-300" },
  VOICEMAIL: { label: "Mailbox", icon: Voicemail, tone: "bg-cyan-400/15 text-cyan-300" },
};
const FILTERS: [string, string][] = [["", "Alle"], ["ENDED", "Beendet"], ["FALLBACK", "Weitergeleitet"], ["VOICEMAIL", "Mailbox"], ["FAILED", "Fehler"]];

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  // Vortag als Kalenderdatum (nicht „jetzt minus 24 Stunden“ – Tage mit Zeitumstellung haben 23/25 Std.)
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (key === today) return "Heute";
  if (key === yesterday) return "Gestern";
  return new Date(`${key}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default function CallsPage() {
  const [status, setStatus] = useState("");
  const { data } = usePoll<{ calls: CallRow[] }>(`/api/calls${status ? `?status=${status}` : ""}`, 8000);
  const { data: stats } = usePoll<{ calls: number; minutes: number; avgDurationSec: number | null; withTicketPercent: number | null; live: number }>("/api/calls/stats", 15_000);
  const [open, setOpen] = useState<string | null>(null);

  const calls = data?.calls;
  const live = stats?.live ?? 0;
  const avg = stats?.avgDurationSec ?? null;
  const groups: [string, CallRow[]][] = [];
  for (const c of calls ?? []) {
    const k = dayKey(c.startedAt);
    const g = groups.find((x) => x[0] === k);
    if (g) g[1].push(c); else groups.push([k, [c]]);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHero
        eyebrow="Alle Gespräche der KI, auch ohne Vorgang"
        title="Anrufe"
        value={stats ? stats.calls : "–"}
        valueLabel="Anrufe diesen Monat"
        stats={[
          { label: "Gesprächsminuten", value: stats ? Math.round(stats.minutes) : "–" },
          { label: "Ø Gesprächsdauer", value: avg == null ? "–" : fmtDuration(avg) },
          { label: "mit Vorgang", value: stats?.withTicketPercent == null ? "–" : `${stats.withTicketPercent} %` },
        ]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
            <LiveDot color={live ? "emerald" : "zinc"} />{live ? `${live} ${live === 1 ? "Gespräch" : "Gespräche"} live` : "Gerade kein Gespräch"}
          </span>
        }
      />

      <div className="glass flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {FILTERS.map(([k, l]) => (
          <button key={k || "all"} type="button" onClick={() => setStatus(k)} aria-pressed={status === k} className={cn("nav-item py-1.5", status === k && "nav-item-active")}>{l}</button>
        ))}
      </div>

      <section className="glass space-y-5 p-3 md:p-4">
        {!calls && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        {calls?.length === 0 && <p className="py-12 text-center text-sm text-zinc-500">{status ? "Keine Anrufe mit diesem Status." : "Noch keine Anrufe."}</p>}
        {groups.map(([day, list]) => (
          <div key={day}>
            <h2 className="mb-2 flex items-baseline justify-between px-2 text-sm font-bold text-zinc-100">
              {dayLabel(day)}<span className="text-xs font-medium text-zinc-500">{list.length} {list.length === 1 ? "Anruf" : "Anrufe"}</span>
            </h2>
            <ul className="space-y-1.5">
              {list.map((c) => {
                const s = STATUS[c.status] ?? STATUS.ENDED;
                const t = c.tickets[0];
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpen(c.id)} className="glass-soft grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-800/70 md:grid-cols-[44px_minmax(0,1fr)_auto_96px] md:px-4">
                      <span className={cn("grid h-11 w-11 place-items-center rounded-full", s.tone)}><s.icon className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-bold text-zinc-50">{c.customer?.companyName ?? c.customer?.name ?? c.fromNumber}</span>
                          {c.status !== "ENDED" && <span className={cn("chip border-transparent", s.tone)}>{s.label}</span>}
                          {c.recordingUrl && <Mic className="h-3.5 w-3.5 text-zinc-500" aria-label="Aufnahme vorhanden" />}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{c.summary ?? (c.tickets.length ? c.tickets.map((x) => x.category).join(", ") : "Keine Zusammenfassung")}</span>
                      </span>
                      <span className="hidden items-center gap-1.5 md:flex">
                        {t && <span className="text-xs font-semibold text-zinc-300">{t.category}</span>}
                        {t && <UrgencyChip urgency={t.urgency} />}
                      </span>
                      <span className="text-right text-xs">
                        <span className="block font-semibold tabular-nums text-zinc-200">{clock(c.startedAt)}</span>
                        <span className="block tabular-nums text-zinc-500">{fmtDuration(c.durationSec)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
      {open && <CallDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = usePoll<CallDetail>(`/api/calls/${id}`, 0);
  return (
    <div className="fixed inset-0 z-50 !m-0 flex justify-end p-0 sm:p-3">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none !bg-[rgb(var(--page)/0.96)] animate-slidein sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 p-5">
          {data ? (
            <div>
              <h3 className="text-lg font-bold text-zinc-50">{data.customer?.companyName ?? data.customer?.name ?? data.fromNumber}</h3>
              <p className="text-xs text-zinc-500">{fmtDateTime(data.startedAt)} · {fmtDuration(data.durationSec)} · {STATUS[data.status]?.label ?? data.status}{data.endReason ? ` · ${data.endReason}` : ""}</p>
            </div>
          ) : <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>
        {data && (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {data.summary && <section><h4 className="label mb-2">Zusammenfassung</h4><p className="text-sm text-zinc-300">{data.summary}</p></section>}
            {data.recordingUrl && <section><h4 className="label mb-2">Aufnahme</h4><WaveformPlayer src={`/api/calls/${data.id}/recording`} seed={data.id} durationSec={data.durationSec} /></section>}
            {data.tickets.length > 0 && (
              <section>
                <h4 className="label mb-2">Vorgänge</h4>
                {data.tickets.map((t) => (
                  <div key={t.id} className="glass-soft mb-2 flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="text-zinc-200">{t.category}</span>
                    <span className="flex gap-1.5"><UrgencyChip urgency={t.urgency} /><StatusChip status={t.status} /></span>
                  </div>
                ))}
              </section>
            )}
            <section><h4 className="label mb-2">Transkript</h4>{data.transcript ? <Transcript text={data.transcript} /> : <p className="text-sm text-zinc-500">Kein Transkript vorhanden.</p>}</section>
          </div>
        )}
      </aside>
    </div>
  );
}
