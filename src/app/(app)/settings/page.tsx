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
          <Field label="Firmenname (so meldet sich die KI)" help={["So nennt die KI Ihr Unternehmen am Telefon und in E-Mails.", "Kurz und sprechbar halten – z. B. „Krüger Schädlingsbekämpfung“ statt „Krüger Schädlingsbekämpfung GmbH & Co. KG“."]}><input className="input" value={draft.tenant.name} onChange={(e) => setT("name", e.target.value)} /></Field>
          <Field label="Branche" help={["Wählt die passende Vorlage: typische Anliegen, Notfall-Stichwörter, Rückfragen der KI und Sicherheitshinweise.", "Ein Wechsel ändert nichts an Ihren eigenen Einträgen."]} hint="Bestimmt Anliegen, Dringlichkeitsregeln und Gesprächsleitfaden.">
            <select className="input" value={draft.tenant.industry} onChange={(e) => setT("industry", e.target.value)}>
              {data.templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Logo-URL" hint="Optional – wird in der Navigation angezeigt."><input className="input" value={draft.tenant.logoUrl ?? ""} onChange={(e) => setT("logoUrl", e.target.value)} placeholder="https://…/logo.png" /></Field>
          <Field label="Zeitzone"><input className="input" value={draft.tenant.timezone} onChange={(e) => setT("timezone", e.target.value)} /></Field>
          <Field label="Kurzbeschreibung des Unternehmens" help={["Ein bis drei Sätze: Was bieten Sie an, für wen, was nicht?", "Die KI nutzt das, um Anfragen einzuordnen und Fragen zu beantworten."]}><textarea className="input min-h-[72px]" value={st.companyDescription} onChange={(e) => setS("companyDescription", e.target.value)} placeholder="Was bieten Sie an, was nicht?" /></Field>
          <Field label="Einsatzgebiet" help={["Orte, PLZ-Bereiche oder Umkreis, z. B. „Berlin und 40 km Umkreis“.", "Liegt ein Anrufer außerhalb, sagt die KI das freundlich und nimmt das Anliegen trotzdem auf."]}><textarea className="input min-h-[72px]" value={st.serviceArea} onChange={(e) => setS("serviceArea", e.target.value)} placeholder="z. B. Hamburg und 50 km Umkreis" /></Field>
        </div>
      </Panel>

      <Panel title="KI-Assistent">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name der Assistenz" help={["Mit diesem Namen stellt sich die KI vor, z. B. „Eira“.", "Die KI sagt immer dazu, dass sie eine digitale Assistenz ist (gesetzliche Pflicht)."]}><input className="input" value={st.assistantName} onChange={(e) => setS("assistantName", e.target.value)} /></Field>
          <Field label="Gesprächsaufzeichnung" help={["Aus (empfohlen): Es wird keine Tonaufnahme gespeichert, nur eine Mitschrift für den Vorgang.", "An: Die KI kündigt die Aufzeichnung zu Beginn an. Vorher rechtlich prüfen lassen (Einwilligung, § 201 StGB)."]} hint="Aus: keine Aufnahme und kein Transkript beim Anbieter (nur Basisdaten). Ist das auf der Plattform noch nicht eingerichtet, wird weiter aufgezeichnet – und dann immer angesagt.">
            <label className="flex h-[38px] items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={st.announceRecording} onChange={(e) => setS("announceRecording", e.target.checked)} />Gespräche aufzeichnen und transkribieren (mit Hinweis)</label>
          </Field>
          <Field label="Einwilligung zur Aufzeichnung" help={["Nur ansagen: Die KI sagt zu Beginn, dass aufgezeichnet wird.", "Ausdrücklich fragen: Die KI fragt, ob aufgezeichnet werden darf. Bei „Nein“ oder ohne klare Antwort löscht die Plattform die Aufnahme nach dem Gespräch beim Anbieter (Mitschrift bleibt für den Vorgang).", "Welche Variante rechtlich nötig ist, vorher klären lassen."]} hint="Gilt nur, wenn aufgezeichnet wird.">
            <select className="input" value={st.recordingConsent} onChange={(e) => setS("recordingConsent", e.target.value as typeof st.recordingConsent)}>
              <option value="announce">Nur ansagen</option>
              <option value="ask">Ausdrücklich fragen (empfohlen)</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Eigene Begrüßung (optional)" help={["Leer lassen = Standardbegrüßung.", "Fehlt in Ihrem Text der Hinweis auf die KI, ergänzt die Plattform ihn automatisch."]} hint="Leer = Standard. Die KI stellt sich immer als digitale Assistenz vor (Transparenzpflicht).">
              <textarea className="input min-h-[60px]" value={st.greeting} onChange={(e) => setS("greeting", e.target.value)} placeholder={`${draft.tenant.name}, guten Tag! Hier spricht ${st.assistantName}, die digitale Assistentin. Wie kann ich helfen?`} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Häufige Fragen & Antworten" help={["Format: „F: Frage“ und darunter „A: Antwort“.", "Die KI beantwortet Fragen nur mit diesen Angaben und erfindet keine Informationen."]} hint="Freitext. Die KI nutzt nur diese Angaben – z. B. Öffnungszeiten, Anfahrt, Zahlungsarten, was Sie nicht anbieten.">
              <textarea className="input min-h-[120px]" value={st.faq} onChange={(e) => setS("faq", e.target.value)} placeholder={"F: Kommen Sie auch am Wochenende?\nA: Nur im Notdienst, mit Zuschlag."} />
            </Field>
          </div>
          <Field label="Aussage zu Preisen" help={["Was die KI zu Preisen sagen darf, z. B. „ab 129 € inkl. Anfahrt“ oder „Preis nach Besichtigung“.", "Die KI macht keine verbindlichen Zusagen."]}><textarea className="input min-h-[60px]" value={st.pricingPolicy} onChange={(e) => setS("pricingPolicy", e.target.value)} /></Field>
          <Field label="Zusätzliche Anweisungen" help={["Besondere Regeln, z. B. „Bei Hausverwaltungen immer die Objektnummer erfragen“.", "Kurz und eindeutig formulieren – eine Regel pro Zeile."]}><textarea className="input min-h-[60px]" value={st.extraInstructions} onChange={(e) => setS("extraInstructions", e.target.value)} placeholder="z. B. Bei Hausverwaltungen immer die Objektnummer erfragen." /></Field>
        </div>
      </Panel>

      <Panel title="Anliegen & Dringlichkeit">
        <div className="space-y-3">
          <Field label="Anliegen-Kategorien" help={["Kommagetrennt, z. B. „Wespen, Ratten, Mäuse“.", "Leer = Kategorien der Branchenvorlage. Die KI ordnet jeden Anruf einer Kategorie zu."]} hint={`Leer = Vorlage „${data.template.label}“: ${data.template.categories.join(", ")}`}>
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
