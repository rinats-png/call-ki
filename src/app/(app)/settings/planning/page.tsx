"use client";

import { Panel, Skeleton } from "@/components/hub/Primitives";
import { Field, SaveBar, useSettings } from "@/components/settings/useSettings";
import { ModuleGate } from "@/components/ModuleGate";

/** Einsatzplanung: Startpunkt, Fahrzeiten bei der Terminsuche, Bündeln, Anfahrtszuschlag */
export default function Page() {
  return <ModuleGate module="planning"><PlanningSettings /></ModuleGate>;
}

function PlanningSettings() {
  const s = useSettings();
  const { data, draft, setS, readOnly } = s;
  if (!data || !draft) return <Skeleton className="h-96" />;
  const p = draft.settings.planning;
  const set = (patch: Partial<typeof p>) => setS("planning", { ...p, ...patch });
  const fee = p.travelFeeCents ? (p.travelFeeCents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <Panel title="Fahrzeiten">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Betriebsadresse (Startpunkt)" help={["Von hier starten die Touren, wenn beim Mitarbeiter keine eigene Startadresse hinterlegt ist (Team → Mitarbeiter bearbeiten).", "Wird nur in Koordinaten umgerechnet, nicht weitergegeben."]}>
              <input className="input" value={p.depotAddress} onChange={(e) => set({ depotAddress: e.target.value })} placeholder="Gartenstraße 8, 55116 Mainz" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2"><input type="checkbox" checked={p.travelAware} onChange={(e) => set({ travelAware: e.target.checked })} />Fahrzeit zwischen Terminen bei der Terminsuche einplanen (Telefon und Online-Buchung)</label>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={p.bundle} onChange={(e) => set({ bundle: e.target.checked })} />Termine in der Nähe bündeln</label>
          <Field label="„In der Nähe“ bis Umweg (Minuten)" help={["Termine, für die der Mitarbeiter höchstens so viele Minuten Umweg fährt, werden zuerst angeboten."]}>
            <input className="input" type="number" min={0} max={60} value={p.bundleMaxDetourMin} onChange={(e) => set({ bundleMaxDetourMin: Number(e.target.value) })} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Notdienst-Termine werden immer schnellstmöglich vergeben, ohne Bündeln. Einsatzgebiete nach Fahrzeit legen Sie je Mitarbeiter unter Team fest.</p>
      </Panel>
      <Panel title="Anfahrtszuschlag">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pauschale netto (€)" help={["Leer = kein Zuschlag.", "Eira nennt die Pauschale am Telefon, und sie steht im Rechnungsentwurf (mit „Angebote & Rechnungen“)."]}>
            <input className="input" inputMode="decimal" defaultValue={fee} key={fee} onBlur={(e) => set({ travelFeeCents: Math.max(0, Math.round(Number((e.target.value || "0").replace(",", ".")) * 100) || 0) })} placeholder="z. B. 25,00" />
          </Field>
          <Field label="ab Fahrzeit (Minuten)"><input className="input" type="number" min={0} max={240} value={p.travelFeeFromMin} onChange={(e) => set({ travelFeeFromMin: Number(e.target.value) })} /></Field>
        </div>
      </Panel>
      <SaveBar {...s} />
    </fieldset>
  );
}
