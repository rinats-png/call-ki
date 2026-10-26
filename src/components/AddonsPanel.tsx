"use client";

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn, eur } from "@/lib/ui";
import { Panel } from "@/components/hub/Primitives";
import { apiFetch, useSession } from "@/components/session";

type Addon = { key: string; name: string; tagline: string; includes: string[]; priceCents: number; available: boolean; active: boolean; inPlan: boolean; bookedAt: string | null; endsAt: string | null };

/** Zusatzoptionen: sofort hinzubuchen, monatlich zum Monatsende kündbar. Nach dem Buchen erscheinen die Funktionen in der Oberfläche. */
export function AddonsPanel({ onChanged }: { onChanged?: () => void }) {
  const { isTenantAdmin, reload: reloadSession } = useSession();
  const { data, reload } = usePoll<{ addons: Addon[] }>("/api/addons", 120_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return null;

  async function act(a: Addon, action: "book" | "cancel") {
    const q = action === "book"
      ? `„${a.name}“ für ${eur(a.priceCents)} netto im Monat hinzubuchen?\n\nDie Funktionen stehen sofort zur Verfügung. Monatlich zum Monatsende kündbar.`
      : `„${a.name}“ zum Monatsende kündigen?\n\nBis dahin bleibt alles nutzbar. Ihre Daten bleiben erhalten.`;
    if (!confirm(q)) return;
    setBusy(a.key); setErr(null);
    try {
      await apiFetch("/api/addons", { method: "POST", json: { key: a.key, action } });
      reload(); await reloadSession(); onChanged?.();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }
  const date = (s: string) => new Date(new Date(s).getTime() - 1).toLocaleDateString("de-DE");

  return (
    <div id="zusatzoptionen" className="scroll-mt-6">
      <Panel title="Zusatzoptionen">
        <p className="mb-4 text-sm text-zinc-400">Ihr KI-Telefonassistent funktioniert ohne Zusatzoptionen. Wenn Sie mehr brauchen, buchen Sie es hier dazu – die neuen Funktionen erscheinen sofort im Menü.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {data.addons.map((a) => (
            <section key={a.key} className={cn("glass-soft flex flex-col gap-3 p-4", a.active && "ring-1 ring-emerald-500/40")}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-zinc-100">{a.name}</h3>
                  {a.active && <span className="chip shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{a.inPlan ? "im Paket" : a.endsAt ? `bis ${date(a.endsAt)}` : "gebucht"}</span>}
                </div>
                <p className="text-xs text-zinc-500">{a.tagline}</p>
              </div>
              <ul className="flex-1 space-y-1 text-sm text-zinc-300">
                {a.includes.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{i}</li>)}
              </ul>
              {!a.inPlan && <div className="text-sm text-zinc-200"><span className="text-lg font-semibold">{eur(a.priceCents)}</span> <span className="text-zinc-500">netto / Monat</span></div>}
              {isTenantAdmin && !a.inPlan && (
                !a.active ? (
                  <button className="btn-primary justify-center" disabled={!!busy || !a.available} onClick={() => act(a, "book")}>{busy === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{a.available ? "Hinzubuchen" : "Derzeit nicht buchbar"}</button>
                ) : a.endsAt ? (
                  <button className="btn-ghost justify-center" disabled={!!busy} onClick={() => act(a, "book")}>Kündigung zurücknehmen</button>
                ) : (
                  <button className="btn-ghost justify-center text-xs" disabled={!!busy} onClick={() => act(a, "cancel")}>Zum Monatsende kündigen</button>
                )
              )}
            </section>
          ))}
        </div>
        {err && <p className="mt-3 text-sm text-amber-400">{err}</p>}
        {!isTenantAdmin && <p className="mt-3 text-xs text-zinc-500">Buchen und Kündigen können nur Administratoren Ihres Unternehmens.</p>}
      </Panel>
    </div>
  );
}
