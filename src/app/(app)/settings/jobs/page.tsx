"use client";

import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";
import { ModuleGate } from "@/components/ModuleGate";
import { useModule } from "@/components/session";

const CHANNELS = [["off", "Aus"], ["sms", "SMS"], ["email", "E-Mail"], ["both", "SMS und E-Mail"]] as const;

/** Techniker-App (Abschluss, Rechnungsentwurf) und Kundenkontakt rund um den Einsatz */
export default function Page() {
  return <ModuleGate module={["field_app", "customer_contact"]}><JobSettings /></ModuleGate>;
}

function JobSettings() {
  const fieldApp = useModule("field_app");
  const contact = useModule("customer_contact");
  const invoicing = useModule("invoicing");
  const s = useSettings();
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const j = draft.settings.jobs;
  const c = draft.settings.contact;
  const setJ = (p: Partial<typeof j>) => setS("jobs", { ...j, ...p });
  const setC = (p: Partial<typeof c>) => setS("contact", { ...c, ...p });
  const rate = j.hourlyRateCents ? (j.hourlyRateCents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      {fieldApp && <Panel title="Techniker-App">
        <div className="grid gap-3 sm:grid-cols-2">
          {invoicing && <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" checked={j.autoInvoiceDraft} onChange={(e) => setJ({ autoInvoiceDraft: e.target.checked })} />Beim Abschluss automatisch einen Rechnungsentwurf anlegen</label>}
          {invoicing && <Field label="Stundensatz netto (€)" help={["Für die Position „Arbeitszeit“ im Rechnungsentwurf.", "Leer = keine Arbeitszeit-Position (z. B. bei Pauschalpreisen)."]}>
            <input className="input" inputMode="decimal" defaultValue={rate} key={rate} onBlur={(e) => setJ({ hourlyRateCents: Math.max(0, Math.round(Number((e.target.value || "0").replace(",", ".")) * 100) || 0) })} placeholder="z. B. 68,00" />
          </Field>}
          <label className="flex items-center gap-2 self-end text-sm text-zinc-300"><input type="checkbox" checked={j.requireSignature} onChange={(e) => setJ({ requireSignature: e.target.checked })} />Kundenunterschrift ist Pflicht</label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Den persönlichen App-Link je Mitarbeiter erzeugen Sie unter Team.</p>
      </Panel>}
      {contact && <Panel title="Kundenkontakt rund um den Einsatz">
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldApp && <Field label="„Techniker ist unterwegs“" help={["Geht raus, sobald der Techniker in der App auf „Unterwegs“ tippt.", "SMS nur, wenn Ihr Paket SMS enthält und der Kunde nicht widersprochen hat."]}>
            <select className="input" value={c.enRoute} onChange={(e) => setC({ enRoute: e.target.value as typeof c.enRoute })}>{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>}
          <Field label="Bitte um Bewertung" help={["Nach Abschluss des Einsatzes, mit Ihrem Bewertungslink (z. B. Google).", "Höchstens einmal je Kunde in 90 Tagen."]}>
            <select className="input" value={c.reviewRequest} onChange={(e) => setC({ reviewRequest: e.target.value as typeof c.reviewRequest })}>{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Bewertungslink"><input className="input" value={c.reviewUrl} onChange={(e) => setC({ reviewUrl: e.target.value })} placeholder="https://g.page/r/…" /></Field>
          <Field label="Bewertung senden nach (Stunden)"><input className="input" type="number" min={0} max={168} value={c.reviewDelayHours} onChange={(e) => setC({ reviewDelayHours: Number(e.target.value) })} /></Field>
        </div>
      </Panel>}
      <SaveBar {...s} />
    </fieldset>
  );
}
