"use client";

import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";

const CH = { off: "Aus", email: "E-Mail", sms: "SMS", both: "E-Mail + SMS" } as const;

export default function Page() {
  const s = useSettings();
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const n = draft.settings.notifications;
  const set = (patch: Partial<typeof n>) => setS("notifications", { ...n, ...patch });

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Wer wird wie informiert?">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bestätigung an Anrufer" hint="Mit Kalendereintrag (.ics) bei Termin.">
            <select className="input" value={n.customerConfirmation} onChange={(e) => set({ customerConfirmation: e.target.value as typeof n.customerConfirmation })}>
              {Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Info an zuständige Mitarbeiter" hint="Mit Termin als Kalendereintrag.">
            <select className="input" value={n.technicianAlert} onChange={(e) => set({ technicianAlert: e.target.value as typeof n.technicianAlert })}>
              {Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Notfall-Alarm">
            <select className="input" value={n.emergencyAlert} onChange={(e) => set({ emergencyAlert: e.target.value as typeof n.emergencyAlert })}>
              {Object.entries(CH).filter(([k]) => k !== "off").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
      </Panel>
      <Panel title="Büro">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kopie aller Vorgänge an" hint="Wird auch als Antwortadresse für Kunden-E-Mails genutzt."><input type="email" className="input" value={n.backofficeEmail} onChange={(e) => set({ backofficeEmail: e.target.value })} placeholder="buero@ihre-firma.de" /></Field>
          <Field label="Mit Microsoft 365" hint="Nur wirksam, wenn Outlook verbunden und ein Entwurfs-Postfach gesetzt ist.">
            <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={n.microsoftDraftsOnly} onChange={(e) => set({ microsoftDraftsOnly: e.target.checked })} />Kundenbestätigung nur als Outlook-Entwurf ablegen</label>
          </Field>
        </div>
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
