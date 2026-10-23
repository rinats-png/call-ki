"use client";

import { cn } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Download } from "lucide-react";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";
import { apiDownload } from "@/components/session";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function Page() {
  const s = useSettings();
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const bh = draft.settings.businessHours;
  const ap = draft.settings.appointments;
  const em = draft.settings.emergency;
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Geschäftszeiten für Termine">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const iso = i + 1;
            const on = bh.days.includes(iso);
            return (
              <button key={d} type="button" onClick={() => setS("businessHours", { ...bh, days: on ? bh.days.filter((x) => x !== iso) : [...bh.days, iso].sort() })}
                className={cn("h-9 w-11 rounded-lg border text-sm font-medium transition", on ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-zinc-700 text-zinc-500")}>
                {d}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Beginn"><input type="time" className="input" value={bh.start} onChange={(e) => setS("businessHours", { ...bh, start: e.target.value })} /></Field>
          <Field label="Ende"><input type="time" className="input" value={bh.end} onChange={(e) => setS("businessHours", { ...bh, end: e.target.value })} /></Field>
        </div>
      </Panel>

      <Panel title="Terminvergabe durch die KI">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dauer eines Termins (Minuten)" hint="0 = Standard der Branche"><input type="number" className="input" value={ap.durationMin} onChange={(e) => setS("appointments", { ...ap, durationMin: num(e.target.value) })} /></Field>
          <Field label="Puffer / Anfahrt zwischen Terminen (Minuten)"><input type="number" className="input" value={ap.bufferMin} onChange={(e) => setS("appointments", { ...ap, bufferMin: num(e.target.value) })} /></Field>
          <Field label="Frühester Termin ab Anruf (Minuten)" hint="Bei hoher Dringlichkeit max. 60 Minuten"><input type="number" className="input" value={ap.leadMin} onChange={(e) => setS("appointments", { ...ap, leadMin: num(e.target.value) })} /></Field>
          <Field label="Wie viele Tage im Voraus"><input type="number" className="input" value={ap.daysAhead} onChange={(e) => setS("appointments", { ...ap, daysAhead: Math.max(1, num(e.target.value)) })} /></Field>
          <Field label="Anzahl angebotener Termine"><input type="number" min={1} max={5} className="input" value={ap.slotsOffered} onChange={(e) => setS("appointments", { ...ap, slotsOffered: Math.min(5, Math.max(1, num(e.target.value))) })} /></Field>
        </div>
      </Panel>

      <Panel title="Notfälle">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notfall-Erkennung">
            <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={em.enabled} onChange={(e) => setS("emergency", { ...em, enabled: e.target.checked })} />Notfälle live durchstellen</label>
          </Field>
          <Field label="Notfall-Nummer (Fallback)" hint="Wenn der zuständige Notdienst keine Direktwahl hinterlegt hat."><input className="input" value={em.transferNumber} onChange={(e) => setS("emergency", { ...em, transferNumber: e.target.value })} placeholder="+49 151 …" /></Field>
        </div>
      </Panel>

      <Panel title="Datenschutz">
        <Field label="Löschfrist für Transkripte & Aufnahmen (Tage)" hint="Danach werden Gesprächsinhalte automatisch gelöscht. Vorgänge (Kunde, Termin, Anliegen) bleiben erhalten.">
          <input type="number" className="input max-w-[200px]" value={draft.settings.retentionDays} onChange={(e) => setS("retentionDays", Math.max(7, num(e.target.value)))} />
        </Field>
        <div className="mt-3">
          <Field label="Datenschutzhinweise für Anrufer (URL)" hint="Ihre Datenschutzinformation zur Telefonassistenz (Art. 13 DSGVO). Die KI nennt diese Adresse auf Nachfrage und bevor sie Kontaktdaten aufnimmt. Textvorlage erhalten Sie vom Plattformbetreiber.">
            <input className="input" type="url" value={draft.settings.privacyUrl} onChange={(e) => setS("privacyUrl", e.target.value.trim())} placeholder="https://ihre-firma.de/datenschutz#telefon" />
          </Field>
        </div>
        {!readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <button type="button" className="btn-ghost" onClick={() => apiDownload("/api/settings/export", "gesamtexport.json").catch((e) => alert((e as Error).message))}>
              <Download className="h-4 w-4" />Gesamtexport aller Daten
            </button>
            Alle Kunden, Vorgänge, Anrufe und Nachrichten als JSON (z. B. bei Vertragsende).
          </div>
        )}
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
