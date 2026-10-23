"use client";

import { useState } from "react";
import { PhoneIncoming, Voicemail, PhoneOff, PhoneForwarded, Loader2, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, fmtDateTime, fmtDuration, timeAgo } from "@/lib/ui";
import { Panel, Skeleton, UrgencyChip, StatusChip } from "@/components/hub/Primitives";
import { Transcript } from "@/components/hub/TicketDrawer";

type CallRow = {
  id: string; fromNumber: string; status: string; startedAt: string; durationSec: number | null; summary: string | null; endReason: string | null; recordingUrl: string | null;
  customer: { id: string; name: string | null; companyName: string | null } | null;
  tickets: { id: string; category: string | null; urgency: string; status: string }[];
};
type CallDetail = CallRow & { transcript: string | null; tickets: (CallRow["tickets"][number] & { summary: string | null })[] };

const STATUS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  RINGING: { label: "Klingelt", icon: PhoneIncoming, tone: "text-cyan-300" },
  IN_PROGRESS: { label: "Läuft", icon: PhoneIncoming, tone: "text-emerald-300" },
  ENDED: { label: "Beendet", icon: PhoneIncoming, tone: "text-zinc-400" },
  FAILED: { label: "Fehler", icon: PhoneOff, tone: "text-amber-300" },
  FALLBACK: { label: "Weitergeleitet", icon: PhoneForwarded, tone: "text-amber-300" },
  VOICEMAIL: { label: "Mailbox", icon: Voicemail, tone: "text-cyan-300" },
};

export default function CallsPage() {
  const { data } = usePoll<{ calls: CallRow[] }>("/api/calls", 8000);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Anrufe</h1>
        <p className="text-sm text-zinc-500">Alle Gespräche der KI – auch ohne Vorgang (aufgelegt, Mailbox, Weiterleitung).</p>
      </header>
      <Panel>
        <ul className="divide-y divide-zinc-800">
          {!data && Array.from({ length: 6 }).map((_, i) => <li key={i} className="py-2"><Skeleton className="h-10" /></li>)}
          {data?.calls.length === 0 && <li className="py-10 text-center text-sm text-zinc-500">Noch keine Anrufe.</li>}
          {data?.calls.map((c) => {
            const s = STATUS[c.status] ?? STATUS.ENDED;
            return (
              <li key={c.id}>
                <button onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-zinc-800/40">
                  <s.icon className={cn("h-4 w-4 shrink-0", s.tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-zinc-100">{c.customer?.companyName ?? c.customer?.name ?? c.fromNumber}</span>
                      <span className="text-xs text-zinc-500">{s.label}</span>
                    </div>
                    <p className="truncate text-xs text-zinc-500">{c.summary ?? (c.tickets.length ? c.tickets.map((t) => t.category).join(", ") : "Keine Zusammenfassung")}</p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{c.tickets.slice(0, 1).map((t) => <UrgencyChip key={t.id} urgency={t.urgency} />)}</div>
                  <div className="shrink-0 text-right text-xs text-zinc-500">
                    <div>{timeAgo(c.startedAt)}</div>
                    <div className="tabular-nums">{fmtDuration(c.durationSec)}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
      {open && <CallDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = usePoll<CallDetail>(`/api/calls/${id}`, 0);
  return (
    <div className="fixed inset-0 z-50 !m-0 flex justify-end">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-md animate-slidein">
        <header className="flex items-start justify-between border-b border-zinc-800 p-5">
          {data ? (
            <div>
              <h3 className="text-lg font-semibold text-zinc-50">{data.customer?.name ?? data.fromNumber}</h3>
              <p className="text-xs text-zinc-500">{fmtDateTime(data.startedAt)} · {fmtDuration(data.durationSec)} · {STATUS[data.status]?.label ?? data.status}{data.endReason ? ` · ${data.endReason}` : ""}</p>
            </div>
          ) : <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>
        {data && (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {data.summary && <section><h4 className="label mb-2">Zusammenfassung</h4><p className="text-sm text-zinc-300">{data.summary}</p></section>}
            {data.recordingUrl && <a href={data.recordingUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">Aufnahme anhören</a>}
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
