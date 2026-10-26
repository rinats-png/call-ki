"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { eur } from "@/lib/ui";
import { Panel } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";

type Plan = { id: string; name: string; description: string; monthlyPriceCents: number; includedMinutes: number; current: boolean };
type Trial = { active: boolean; endsAt: string; daysLeft: number; minutesUsed: number; minutesIncluded: number | null; nextPlan: { id: string; name: string } | null; ended: boolean };

/** Paket für die Zeit nach dem Test wählen – ohne Anfrage, startet automatisch am Testende (bzw. sofort, wenn der Test vorbei ist). */
export function TrialPlanPanel({ trial, plans, onChanged }: { trial: Trial; plans: Plan[]; onChanged: () => void }) {
  const { isTenantAdmin, reload } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const end = new Date(trial.endsAt).toLocaleDateString("de-DE");
  async function choose(p: Plan) {
    const q = trial.active ? `Nach der Testphase (ab ${end}) mit „${p.name}“ für ${eur(p.monthlyPriceCents)} netto im Monat weitermachen?` : `„${p.name}“ für ${eur(p.monthlyPriceCents)} netto im Monat jetzt starten? Eira nimmt sofort wieder ab.`;
    if (!confirm(q)) return;
    setBusy(p.id); setErr(null);
    try { await apiFetch("/api/billing/trial-plan", { method: "POST", json: { planId: p.id } }); await reload(); onChanged(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }
  return (
    <div id="testphase" className="scroll-mt-6">
      <Panel title={trial.ended ? "Testphase beendet – Paket wählen" : `Testphase bis ${end}`}>
        <p className="mb-3 text-sm text-zinc-400">
          {trial.ended ? "Wählen Sie ein Paket – danach nimmt Eira sofort wieder Ihre Anrufe an." : <>Noch {trial.daysLeft} Tage{trial.minutesIncluded != null ? `, ${trial.minutesUsed} von ${trial.minutesIncluded} Testminuten genutzt` : ""}. Bis dahin ist alles kostenlos. {trial.nextPlan ? <>Danach geht es automatisch mit <b className="text-zinc-200">{trial.nextPlan.name}</b> weiter – Sie können das bis zum Testende ändern.</> : "Wählen Sie schon jetzt, womit es danach weitergeht – dann gibt es keine Unterbrechung."}</>}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((p) => {
            const chosen = trial.nextPlan?.id === p.id;
            return (
              <div key={p.id} className="glass-soft flex flex-col gap-2 p-4">
                <div className="font-semibold text-zinc-100">{p.name}</div>
                {p.description && <p className="text-xs text-zinc-500">{p.description}</p>}
                <div className="text-sm text-zinc-300"><span className="text-lg font-semibold">{eur(p.monthlyPriceCents)}</span> netto / Monat · {p.includedMinutes} Min. inklusive</div>
                {isTenantAdmin && (chosen ? <span className="mt-auto inline-flex items-center gap-1 text-sm text-emerald-300"><Check className="h-4 w-4" />Gewählt</span> : <button className="btn-primary mt-auto justify-center" disabled={!!busy} onClick={() => choose(p)}>{busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}{trial.active ? "Danach mit diesem Paket" : "Jetzt starten"}</button>)}
              </div>
            );
          })}
        </div>
        {err && <p className="mt-2 text-sm text-amber-400">{err}</p>}
      </Panel>
    </div>
  );
}
