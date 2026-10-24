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
          <Field label="Bestätigung an Anrufer" help={["E-Mail: Der Anrufer erhält eine Bestätigung mit Termin und Kalendereintrag (wenn er eine E-Mail-Adresse nennt).", "SMS: Nur wenn im Paket enthalten."]} hint="Mit Kalendereintrag (.ics) bei Termin.">
            <select className="input" value={n.customerConfirmation} onChange={(e) => set({ customerConfirmation: e.target.value as typeof n.customerConfirmation })}>
              {Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Info an zuständige Mitarbeiter" help={["Der zugeordnete Mitarbeiter erhält Anliegen, Adresse und Termin.", "Bei SMS wird die Direktwahl aus „Team“ verwendet."]} hint="Mit Termin als Kalendereintrag.">
            <select className="input" value={n.technicianAlert} onChange={(e) => set({ technicianAlert: e.target.value as typeof n.technicianAlert })}>
              {Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Notfall-Alarm" help={["Bei erkannten Notfällen wird der Bereitschaftsdienst sofort informiert – zusätzlich zur Live-Durchstellung."]}>
            <select className="input" value={n.emergencyAlert} onChange={(e) => set({ emergencyAlert: e.target.value as typeof n.emergencyAlert })}>
              {Object.entries(CH).filter(([k]) => k !== "off").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
      </Panel>
      <Panel title="Terminerinnerung">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Erinnerung an Kunden" help={["Vor jedem gebuchten Termin bekommt der Kunde eine Erinnerung mit Datum, Uhrzeit und Ihrer Nummer zum Verschieben oder Absagen.", "E-Mail nur, wenn der Kunde eine Adresse genannt hat. SMS nur, wenn im Paket enthalten.", "Wurde der Termin erst kurz vorher gebucht, genügt die Bestätigung – dann keine zusätzliche Erinnerung."]} hint="Weniger Leerfahrten durch vergessene Termine.">
            <select className="input" value={n.reminder} onChange={(e) => set({ reminder: e.target.value as typeof n.reminder })}>
              {Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Wie lange vorher?" hint="2 bis 72 Stunden.">
            <select className="input" value={n.reminderHoursBefore} onChange={(e) => set({ reminderHoursBefore: Number(e.target.value) })}>
              {[2, 4, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} Stunden</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Rufnummer in der Erinnerung" hint="Ihre bekannte Firmennummer – dort kann der Kunde verschieben oder absagen."><input className="input" value={n.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder="z. B. 030 1234567" /></Field></div>
        </div>
      </Panel>
      <Panel title="Büro">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kopie aller Vorgänge an" help={["Optional eine Büro-Adresse, die jeden Vorgang als Kopie bekommt."]} hint="Wird auch als Antwortadresse für Kunden-E-Mails genutzt."><input type="email" className="input" value={n.backofficeEmail} onChange={(e) => set({ backofficeEmail: e.target.value })} placeholder="buero@ihre-firma.de" /></Field>
          <Field label="Mit Microsoft 365" hint="Nur wirksam, wenn Outlook verbunden und ein Entwurfs-Postfach gesetzt ist.">
            <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={n.microsoftDraftsOnly} onChange={(e) => set({ microsoftDraftsOnly: e.target.checked })} />Kundenbestätigung nur als Outlook-Entwurf ablegen</label>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Gesprächsinhalt in E-Mails und Kalender" help={["Die Zusammenfassung des Gesprächs kann Gesundheitsangaben oder andere sensible Details enthalten.", "Ausgeschaltet stehen in Mitarbeiter-E-Mails und Kalendereinträgen nur Kunde, Adresse, Anliegen und Termin – die Zusammenfassung gibt es dann nur im Portal."]}>
              <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={n.summaryInNotifications} onChange={(e) => set({ summaryInNotifications: e.target.checked })} />Zusammenfassung in Mitarbeiter-E-Mails und Kalendereinträge übernehmen</label>
            </Field>
          </div>
        </div>
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
