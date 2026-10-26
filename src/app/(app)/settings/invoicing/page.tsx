"use client";

import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";
import { ModuleGate } from "@/components/ModuleGate";

/** Angaben des Betriebs als Rechnungssteller (§ 14 UStG) und Mahnwesen */
export default function Page() {
  return <ModuleGate module="invoicing"><InvoicingSettings /></ModuleGate>;
}

function InvoicingSettings() {
  const s = useSettings();
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const v = draft.settings.invoicing;
  const set = (patch: Partial<typeof v>) => setS("invoicing", { ...v, ...patch });
  const text = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [k]: e.target.value } as Partial<typeof v>);

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Rechnungssteller">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Firmierung" help={["So steht Ihr Betrieb auf Angeboten und Rechnungen, z. B. „Becker Sanitär GmbH“.", "Leer = Firmenname aus „Unternehmen & KI“."]}><input className="input" value={v.legalName} onChange={text("legalName")} placeholder={draft.tenant.name} /></Field>
          <Field label="Anschrift" help={["Straße, PLZ und Ort – Pflichtangabe auf jeder Rechnung."]}><textarea className="input min-h-[60px]" value={v.address} onChange={text("address")} placeholder={"Gartenstraße 8\n55116 Mainz"} /></Field>
          <Field label="Steuernummer" help={["Steuernummer oder USt-IdNr. muss auf der Rechnung stehen (§ 14 UStG).", "Fragen Sie im Zweifel Ihre Steuerberatung."]}><input className="input" value={v.taxNumber} onChange={text("taxNumber")} placeholder="26/123/45678" /></Field>
          <Field label="USt-IdNr."><input className="input" value={v.vatId} onChange={text("vatId")} placeholder="DE123456789" /></Field>
          <Field label="E-Mail für Rückfragen"><input className="input" type="email" value={v.email} onChange={text("email")} /></Field>
          <Field label="Telefon"><input className="input" value={v.phone} onChange={text("phone")} /></Field>
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" checked={v.smallBusiness} onChange={(e) => set({ smallBusiness: e.target.checked })} />Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer ausweisen)</label>
        </div>
      </Panel>
      <Panel title="Bankverbindung & Zahlung">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IBAN" help={["Für den Überweisungs-QR-Code (GiroCode) auf jeder Rechnung: Kunden scannen ihn mit der Banking-App.", "Ohne gültige IBAN wird kein QR-Code gezeigt."]}><input className="input font-mono" value={v.iban} onChange={text("iban")} placeholder="DE89 3704 0044 0532 0130 00" /></Field>
          <Field label="BIC (optional)"><input className="input font-mono" value={v.bic} onChange={text("bic")} /></Field>
          <Field label="Bank (optional)"><input className="input" value={v.bankName} onChange={text("bankName")} /></Field>
          <Field label="Zahlungsziel (Tage)"><input className="input" type="number" min={0} max={90} value={v.paymentDays} onChange={(e) => set({ paymentDays: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2"><Field label="Fußzeile (optional)" help={["Z. B. Geschäftsführer, Handelsregister, Hinweise."]}><textarea className="input min-h-[60px]" value={v.footer} onChange={text("footer")} /></Field></div>
        </div>
      </Panel>
      <Panel title="Zahlungserinnerung & Mahnung">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" checked={v.autoReminders} onChange={(e) => set({ autoReminders: e.target.checked })} />Automatisch per E-Mail erinnern, wenn eine Rechnung überfällig ist</label>
          <Field label="Erinnerung nach (Tagen über Fälligkeit)"><input className="input" type="number" min={1} max={120} value={v.reminderDays[0] ?? 7} onChange={(e) => set({ reminderDays: [Number(e.target.value), v.reminderDays[1] ?? 21] })} /></Field>
          <Field label="Mahnung nach (Tagen über Fälligkeit)"><input className="input" type="number" min={1} max={120} value={v.reminderDays[1] ?? 21} onChange={(e) => set({ reminderDays: [v.reminderDays[0] ?? 7, Number(e.target.value)] })} /></Field>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Nur Kunden mit E-Mail-Adresse. Manuell geht es jederzeit über „Erinnern“ bei der Rechnung.</p>
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
