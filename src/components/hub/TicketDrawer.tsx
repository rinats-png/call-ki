"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Phone, MapPin, Mail, Building2, CalendarPlus, Loader2, Bot, User, Send, PlayCircle } from "lucide-react";
import type { CustomerType, EmployeeRole } from "@/lib/constants";
import { cn, fmtDateTime, fmtDuration, MESSAGE_STATUS, PURPOSE_LABEL, STATUS_STYLE } from "@/lib/ui";
import { apiFetch, useSession } from "../session";
import type { EmployeeRow, TicketDetail } from "./types";
import { StatusChip, UrgencyChip } from "./Primitives";

type Line = { who: "ai" | "caller" | "other"; text: string };

export function parseTranscript(t: string): Line[] {
  return t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(agent|ki|ai|assistant|bot|user|kunde|caller|anrufer)\s*:\s*(.*)$/i);
      if (!m) return { who: "other" as const, text: l };
      return { who: /^(agent|ki|ai|assistant|bot)$/i.test(m[1]) ? "ai" : "caller", text: m[2] } as Line;
    });
}

export function Transcript({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseTranscript(text).map((l, i) => (
        <div key={i} className={cn("flex gap-2", l.who === "caller" && "flex-row-reverse")}>
          <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1", l.who === "ai" ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/30" : "bg-zinc-800 text-zinc-400 ring-zinc-700")}>
            {l.who === "ai" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          </span>
          <p className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed", l.who === "ai" ? "rounded-tl-sm bg-zinc-800/70 text-zinc-200" : "rounded-tr-sm bg-cyan-500/10 text-cyan-50")}>{l.text}</p>
        </div>
      ))}
    </div>
  );
}

export function TicketDrawer({ id, employees, onClose, onChanged }: { id: string; employees: EmployeeRow[]; onClose: () => void; onChanged: () => void }) {
  const { me } = useSession();
  const t0 = me?.tenant;
  const [t, setT] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const r = await apiFetch<TicketDetail>(`/api/tickets/${id}`).catch(() => null);
    setT(r);
    setNotes(r?.notes ?? "");
  }, [id]);

  useEffect(() => {
    setT(null);
    setMsg(null);
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(data: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      await apiFetch(`/api/tickets/${id}`, { method: "PATCH", json: data });
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }

  async function notify() {
    setBusy("notify");
    setMsg(null);
    try {
      const r = await apiFetch<{ result: { errors: string[]; customer: string[]; technician: string[] } }>(`/api/tickets/${id}/notify`, {
        method: "POST", json: slot ? { appointmentStart: new Date(slot).toISOString() } : {},
      });
      const parts = [...r.result.technician.map((x) => `Mitarbeiter: ${x}`), ...r.result.customer.map((x) => `Kunde: ${x}`)];
      setMsg(r.result.errors.length ? { ok: false, text: r.result.errors.join(" · ") } : { ok: true, text: parts.length ? parts.join(" · ") : "Nichts zu versenden (Einstellungen prüfen)." });
      setSlot("");
      await load();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-md animate-slidein">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 p-5">
          {t ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <UrgencyChip urgency={t.urgency} />
                <StatusChip status={t.status} />
                <span className="font-mono text-[11px] text-zinc-500">#{t.id.slice(-8).toUpperCase()}</span>
              </div>
              <h3 className="mt-2 truncate text-lg font-semibold text-zinc-50">{t.category ?? "Sonstiges"} · {t.customer.companyName ?? t.customer.name ?? t.customer.phone}</h3>
              <p className="text-xs text-zinc-500">{fmtDateTime(t.createdAt)}</p>
            </div>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          )}
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Schließen"><X className="h-4 w-4" /></button>
        </header>

        {t && (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <section className="glass-soft grid grid-cols-1 gap-2.5 p-4 text-sm sm:grid-cols-2">
              <Info icon={Phone} value={<a href={`tel:${t.customer.phone}`} className="hover:text-cyan-300">{t.customer.phone}</a>} />
              <Info icon={Building2} value={`${t0?.customerTypeLabels[t.customer.customerType as CustomerType] ?? t.customer.customerType} · ${t.customer.status === "NEW" ? "Neukunde" : "Bestandskunde"}`} />
              <Info icon={MapPin} value={[t.customer.address, t.customer.postalCode].filter(Boolean).join(", ") || "Keine Adresse"} />
              <Info icon={Mail} value={t.customer.email ?? "Keine E-Mail"} />
            </section>

            <section>
              <h4 className="label mb-2">Zusammenfassung</h4>
              <p className="text-sm leading-relaxed text-zinc-300">{t.summary ?? "—"}</p>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <h4 className="label mb-2">Zuständig</h4>
                <select className="input" value={t.assignedEmployeeId ?? ""} onChange={(e) => patch({ assignedEmployeeId: e.target.value || null }, "assign")} disabled={busy === "assign"}>
                  <option value="">— niemand —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({t0?.roleLabels[e.role as EmployeeRole] ?? e.role})</option>)}
                </select>
              </div>
              <div>
                <h4 className="label mb-2">Status</h4>
                <select className="input" value={t.status} onChange={(e) => patch({ status: e.target.value }, "status")} disabled={busy === "status"}>
                  {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </section>

            <section className="glass-soft p-4">
              <h4 className="label mb-3">Termin & Benachrichtigung</h4>
              <p className="mb-3 text-sm text-zinc-300">
                {t.appointmentStart ? <>Termin: <b>{fmtDateTime(t.appointmentStart)}</b>{t.calendarEventId && <span className="ml-2 chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Outlook</span>}</> : "Noch kein Termin vergeben."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="datetime-local" className="input sm:flex-1" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Neuer Termin" />
                <button className="btn-primary" onClick={notify} disabled={busy === "notify"}>
                  {busy === "notify" ? <Loader2 className="h-4 w-4 animate-spin" /> : slot ? <CalendarPlus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {slot ? "Termin setzen & senden" : "Erneut benachrichtigen"}
                </button>
              </div>
              {msg && <p className={cn("mt-2 text-xs", msg.ok ? "text-emerald-400" : "text-amber-400")}>{msg.text}</p>}
              {t.messages.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
                  {t.messages.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-zinc-400">{m.channel === "SMS" ? "SMS" : "E-Mail"} · {PURPOSE_LABEL[m.purpose] ?? m.purpose} → {m.recipient}</span>
                      <span className={cn("chip shrink-0", MESSAGE_STATUS[m.status]?.chip)} title={m.error ?? undefined}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="label mb-2">Interne Notizen</h4>
              <textarea className="input min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z. B. Rückruf versucht, Kunde bittet um Termin nach 16 Uhr" />
              {notes !== (t.notes ?? "") && (
                <button className="btn-ghost mt-2 text-xs" onClick={() => patch({ notes }, "notes")} disabled={busy === "notes"}>Notiz speichern</button>
              )}
            </section>

            {t.call && (
              <section>
                <h4 className="label mb-2">Anruf</h4>
                <p className="mb-2 text-xs text-zinc-500">{fmtDateTime(t.call.startedAt)} · {fmtDuration(t.call.durationSec)}{t.call.endReason ? ` · ${t.call.endReason}` : ""}</p>
                {t.call.recordingUrl && (
                  <a href={t.call.recordingUrl} target="_blank" rel="noreferrer" className="btn-ghost mb-3 text-xs"><PlayCircle className="h-4 w-4" />Aufnahme anhören</a>
                )}
              </section>
            )}

            <section>
              <h4 className="label mb-2">Transkript</h4>
              {t.transcript ? <Transcript text={t.transcript} /> : <p className="text-sm text-zinc-500">Noch kein Transkript – wird nach Gesprächsende automatisch ergänzt.</p>}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Info({ icon: Icon, value }: { icon: React.ComponentType<{ className?: string }>; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-zinc-300">
      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
      <span className="truncate">{value}</span>
    </div>
  );
}
