"use client";

import { useEffect, useState } from "react";
import { X, Phone, MapPin, Mail, Building2, CalendarPlus, Loader2, Bot, User } from "lucide-react";
import { CUSTOMER_TYPE_LABEL, ROLE_LABEL, type CustomerType, type EmployeeRole } from "@/lib/constants";
import { cn, fmtDateTime } from "@/lib/ui";
import type { EmployeeRow, TicketDetail } from "./types";
import { StatusChip, UrgencyChip } from "./Primitives";

type Line = { who: "ai" | "caller" | "other"; text: string };

function parseTranscript(t: string): Line[] {
  return t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(agent|ki|ai|assistant|bot|user|kunde|caller|anrufer)\s*:\s*(.*)$/i);
      if (!m) return { who: "other" as const, text: l };
      const who = /^(agent|ki|ai|assistant|bot)$/i.test(m[1]) ? "ai" : "caller";
      return { who, text: m[2] } as Line;
    });
}

export function TicketDrawer({ id, employees, onClose, onChanged }: { id: string; employees: EmployeeRow[]; onClose: () => void; onChanged: () => void }) {
  const [t, setT] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [slot, setSlot] = useState("");

  useEffect(() => {
    setT(null);
    setMsg(null);
    fetch(`/api/tickets/${id}`, { cache: "no-store" }).then(async (r) => r.ok && setT(await r.json()));
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patch(data: Record<string, unknown>, label: string) {
    setBusy(label);
    const r = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (r.ok) {
      setT(await r.json());
      onChanged();
    }
    setBusy(null);
  }

  async function sync() {
    setBusy("sync");
    setMsg(null);
    const body = slot ? { appointmentStart: new Date(slot).toISOString() } : {};
    const r = await fetch(`/api/tickets/${id}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (j.ticket) setT(j.ticket);
    const errs: string[] = j.result?.errors ?? [];
    setMsg(
      r.ok
        ? { ok: true, text: j.result?.dryRun ? "Simuliert (Graph nicht konfiguriert)." : "Mit Outlook synchronisiert." }
        : { ok: false, text: errs.join(" · ") || "Synchronisierung fehlgeschlagen." },
    );
    onChanged();
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
                <span className="font-mono text-[11px] text-zinc-600">#{t.id.slice(-8)}</span>
              </div>
              <h3 className="mt-2 truncate text-lg font-semibold text-zinc-50">{t.pestType ?? "Unbekannt"} · {t.customer.companyName ?? t.customer.name ?? t.customer.phone}</h3>
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
              <Info icon={Building2} value={`${CUSTOMER_TYPE_LABEL[t.customer.customerType as CustomerType] ?? t.customer.customerType} · ${t.customer.status === "NEW" ? "Neukunde" : "Bestandskunde"}`} />
              <Info icon={MapPin} value={[t.customer.address, t.customer.postalCode].filter(Boolean).join(", ") || "Keine Adresse"} />
              <Info icon={Mail} value={t.customer.email ?? "Keine E-Mail"} />
            </section>

            <section>
              <h4 className="label mb-2">Zusammenfassung</h4>
              <p className="text-sm leading-relaxed text-zinc-300">{t.summary ?? "—"}</p>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <h4 className="label mb-2">Zugewiesen</h4>
                <select
                  className="input"
                  value={t.assignedEmployeeId ?? ""}
                  onChange={(e) => patch({ assignedEmployeeId: e.target.value || null }, "assign")}
                  disabled={busy === "assign"}
                >
                  <option value="">— niemand —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({ROLE_LABEL[e.role as EmployeeRole] ?? e.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <h4 className="label mb-2">Status</h4>
                <div className="flex gap-1">
                  {(["PENDING", "PROCESSED", "ESCALATED"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => patch({ status: s }, "status")}
                      disabled={busy === "status"}
                      className={cn("btn flex-1 border px-2 py-2 text-xs", t.status === s ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200")}
                    >
                      {{ PENDING: "Offen", PROCESSED: "Erledigt", ESCALATED: "Eskaliert" }[s]}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-soft p-4">
              <h4 className="label mb-3">Microsoft Outlook</h4>
              <div className="mb-3 space-y-1.5 text-xs">
                <SyncRow label="Kalendertermin" id={t.outlookEventId} />
                <SyncRow label="E-Mail-Entwurf" id={t.outlookDraftId} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="datetime-local" className="input sm:flex-1" value={slot} onChange={(e) => setSlot(e.target.value)} disabled={!!t.outlookEventId} />
                <button className="btn-primary" onClick={sync} disabled={busy === "sync" || (!!t.outlookEventId && !!t.outlookDraftId)}>
                  {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                  Synchronisieren
                </button>
              </div>
              {msg && <p className={cn("mt-2 text-xs", msg.ok ? "text-emerald-400" : "text-amber-400")}>{msg.text}</p>}
            </section>

            <section>
              <h4 className="label mb-2">Transkript</h4>
              {t.transcript ? (
                <div className="space-y-2">
                  {parseTranscript(t.transcript).map((l, i) => (
                    <div key={i} className={cn("flex gap-2", l.who === "caller" && "flex-row-reverse")}>
                      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1", l.who === "ai" ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/30" : "bg-zinc-800 text-zinc-400 ring-zinc-700")}>
                        {l.who === "ai" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      </span>
                      <p className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed", l.who === "ai" ? "rounded-tl-sm bg-zinc-900 text-zinc-200" : "rounded-tr-sm bg-cyan-500/10 text-cyan-50")}>{l.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Noch kein Transkript – wird nach Gesprächsende automatisch ergänzt.</p>
              )}
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

function SyncRow({ label, id }: { label: string; id: string | null }) {
  const dry = id?.startsWith("dryrun-");
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400">{label}</span>
      {id ? (
        <span className={cn("chip", dry ? "border-zinc-700 bg-zinc-800 text-zinc-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}>{dry ? "Simuliert" : "Angelegt"}</span>
      ) : (
        <span className="chip border-zinc-800 text-zinc-500">Ausstehend</span>
      )}
    </div>
  );
}
