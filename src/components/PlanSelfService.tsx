"use client";

import { useState } from "react";
import { Loader2, PlusCircle, Repeat } from "lucide-react";
import { eur } from "@/lib/ui";
import { Panel } from "@/components/hub/Primitives";
import { apiFetch } from "@/components/session";

export type SelfServiceData = {
  packs: { minutes: number; priceCents: number }[];
  plans: { id: string; name: string; description: string; monthlyPriceCents: number; includedMinutes: number; current: boolean }[];
  openRequest: { planName: string; createdAt: string } | null;
  topUps: { minutes: number; priceCents: number }[];
};

/** Kunden-Admin: Minuten für den laufenden Monat nachbuchen und Paketwechsel anfragen. */
export function PlanSelfService({ data, onChanged }: { data: SelfServiceData; onChanged: () => void }) {
  const [pack, setPack] = useState<number | null>(null);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const others = data.plans.filter((p) => !p.current);
  const chosen = data.packs.find((p) => p.minutes === pack);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={<span className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-cyan-300" />Mehr Minuten buchen</span>}>
        {data.packs.length === 0 ? (
          <p className="text-sm text-zinc-400">Für Ihr Paket sind keine Minutenpakete hinterlegt. Sprechen Sie uns gern an.</p>
        ) : (
          <>
            <p className="text-sm text-zinc-400">Zusätzliche Minuten gelten sofort und bis zum Monatsende. Sie erscheinen auf der Rechnung dieses Monats.</p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Minutenpaket">
              {data.packs.map((p) => (
                <button key={p.minutes} type="button" role="radio" aria-checked={pack === p.minutes} onClick={() => setPack(p.minutes)}
                  className={`rounded-xl border p-3 text-center transition ${pack === p.minutes ? "border-cyan-400 bg-cyan-400/10" : "border-zinc-800 hover:border-zinc-600"}`}>
                  <div className="text-lg font-semibold text-zinc-50">+{p.minutes}</div>
                  <div className="text-xs text-zinc-400">{eur(p.priceCents)} netto</div>
                </button>
              ))}
            </div>
            <button className="btn-primary mt-3" disabled={!chosen || busy}
              onClick={() => chosen && run(async () => {
                await apiFetch("/api/billing/topup", { method: "POST", json: { minutes: chosen.minutes } });
                setPack(null);
                return `${chosen.minutes} Minuten sind gebucht und sofort verfügbar.`;
              })}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{chosen ? `${chosen.minutes} Minuten für ${eur(chosen.priceCents)} buchen` : "Paket wählen"}
            </button>
            {data.topUps.length > 0 && <p className="mt-2 text-xs text-zinc-500">Diesen Monat gebucht: {data.topUps.map((t) => `+${t.minutes}`).join(", ")} Minuten.</p>}
          </>
        )}
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Repeat className="h-4 w-4 text-cyan-300" />Paket wechseln</span>}>
        {data.openRequest ? (
          <p className="text-sm text-zinc-300">Ihre Anfrage zum Paket <b>{data.openRequest.planName}</b> vom {new Date(data.openRequest.createdAt).toLocaleDateString("de-DE")} liegt uns vor. Wir melden uns.</p>
        ) : others.length === 0 ? (
          <p className="text-sm text-zinc-400">Derzeit gibt es kein anderes Paket.</p>
        ) : (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await apiFetch("/api/billing/plan-request", { method: "POST", json: { planId, note } });
              setNote("");
              return "Anfrage gesendet. Wir melden uns, sobald das neue Paket aktiv ist.";
            });
          }}>
            <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)} required aria-label="Gewünschtes Paket">
              <option value="">Gewünschtes Paket wählen …</option>
              {others.map((p) => <option key={p.id} value={p.id}>{p.name} – {eur(p.monthlyPriceCents)} / Monat, {p.includedMinutes} Min. inklusive</option>)}
            </select>
            <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Nachricht (optional), z. B. gewünschter Starttermin" aria-label="Nachricht" />
            <button className="btn-primary" disabled={!planId || busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Wechsel anfragen</button>
          </form>
        )}
      </Panel>
      {msg && <p role="status" className={`lg:col-span-2 text-sm ${msg.ok ? "text-emerald-300" : "text-amber-300"}`}>{msg.text}</p>}
    </div>
  );
}
