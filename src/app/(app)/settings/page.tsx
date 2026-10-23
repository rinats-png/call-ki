"use client";

import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, ListInput, SaveBar, useSettings } from "@/components/settings/useSettings";

export default function Page() {
  const s = useSettings();
  const { data, draft, setS, setT, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const st = draft.settings;

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Unternehmen">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Firmenname (so meldet sich die KI)"><input className="input" value={draft.tenant.name} onChange={(e) => setT("name", e.target.value)} /></Field>
          <Field label="Branche" hint="Bestimmt Anliegen, Dringlichkeitsregeln und Gesprächsleitfaden.">
            <select className="input" value={draft.tenant.industry} onChange={(e) => setT("industry", e.target.value)}>
              {data.templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Logo-URL" hint="Optional – wird in der Navigation angezeigt."><input className="input" value={draft.tenant.logoUrl ?? ""} onChange={(e) => setT("logoUrl", e.target.value)} placeholder="https://…/logo.png" /></Field>
          <Field label="Zeitzone"><input className="input" value={draft.tenant.timezone} onChange={(e) => setT("timezone", e.target.value)} /></Field>
          <Field label="Kurzbeschreibung des Unternehmens"><textarea className="input min-h-[72px]" value={st.companyDescription} onChange={(e) => setS("companyDescription", e.target.value)} placeholder="Was bieten Sie an, was nicht?" /></Field>
          <Field label="Einsatzgebiet"><textarea className="input min-h-[72px]" value={st.serviceArea} onChange={(e) => setS("serviceArea", e.target.value)} placeholder="z. B. Hamburg und 50 km Umkreis" /></Field>
        </div>
      </Panel>

      <Panel title="KI-Assistent">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name der Assistenz"><input className="input" value={st.assistantName} onChange={(e) => setS("assistantName", e.target.value)} /></Field>
          <Field label="Aufzeichnungshinweis">
            <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={st.announceRecording} onChange={(e) => setS("announceRecording", e.target.checked)} />In der Begrüßung auf Aufzeichnung hinweisen</label>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Eigene Begrüßung (optional)" hint="Leer = Standard. Die KI stellt sich immer als digitale Assistenz vor (Transparenzpflicht).">
              <textarea className="input min-h-[60px]" value={st.greeting} onChange={(e) => setS("greeting", e.target.value)} placeholder={`${draft.tenant.name}, guten Tag! Hier spricht ${st.assistantName}, die digitale Assistentin. Wie kann ich helfen?`} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Häufige Fragen & Antworten" hint="Freitext. Die KI nutzt nur diese Angaben – z. B. Öffnungszeiten, Anfahrt, Zahlungsarten, was Sie nicht anbieten.">
              <textarea className="input min-h-[120px]" value={st.faq} onChange={(e) => setS("faq", e.target.value)} placeholder={"F: Kommen Sie auch am Wochenende?\nA: Nur im Notdienst, mit Zuschlag."} />
            </Field>
          </div>
          <Field label="Aussage zu Preisen"><textarea className="input min-h-[60px]" value={st.pricingPolicy} onChange={(e) => setS("pricingPolicy", e.target.value)} /></Field>
          <Field label="Zusätzliche Anweisungen"><textarea className="input min-h-[60px]" value={st.extraInstructions} onChange={(e) => setS("extraInstructions", e.target.value)} placeholder="z. B. Bei Hausverwaltungen immer die Objektnummer erfragen." /></Field>
        </div>
      </Panel>

      <Panel title="Anliegen & Dringlichkeit">
        <div className="space-y-3">
          <Field label="Anliegen-Kategorien" hint={`Leer = Vorlage „${data.template.label}“: ${data.template.categories.join(", ")}`}>
            <ListInput value={st.categories} onChange={(v) => setS("categories", v)} placeholder="Kommagetrennt" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["critical", "high", "low"] as const).map((k) => (
              <Field key={k} label={{ critical: "Zusätzliche Notfall-Stichwörter", high: "… für hohe Dringlichkeit", low: "… für niedrige Dringlichkeit" }[k]} hint={`Vorlage: ${data.template.urgency[k].slice(0, 6).join(", ")}${data.template.urgency[k].length > 6 ? " …" : ""}`}>
                <ListInput value={st.urgencyKeywords[k]} onChange={(v) => setS("urgencyKeywords", { ...st.urgencyKeywords, [k]: v })} placeholder="Kommagetrennt" />
              </Field>
            ))}
          </div>
        </div>
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
