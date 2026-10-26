"use client";

import Link from "next/link";
import { Hourglass } from "lucide-react";
import { cn } from "@/lib/ui";
import { useSession } from "./session";

/** Testphase: verbleibende Tage und Minuten; nach Ablauf deutlicher Hinweis mit Weg zum Paket. */
export function TrialBanner() {
  const { me, isTenantAdmin } = useSession();
  const t = me?.tenant?.trial;
  if (!t || (!t.active && !t.ended) || (t.ended && me?.tenant?.status !== "PAUSED")) return null;
  const minutes = t.minutesIncluded != null ? ` · ${t.minutesUsed} von ${t.minutesIncluded} Minuten genutzt` : "";
  const urgent = t.ended || t.daysLeft <= 3 || (t.minutesIncluded != null && t.minutesUsed >= t.minutesIncluded);
  return (
    <div className={cn("mx-auto mb-4 flex max-w-[1500px] flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2 text-sm", urgent ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100")}>
      <span className="flex min-w-0 items-start gap-2">
        <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t.ended ? <><b>Ihre Testphase ist beendet.</b> Anrufe gehen an Ihre Ersatznummer, bis Sie ein Paket wählen.</>
            : <><b>Testphase:</b> noch {t.daysLeft} Tag{t.daysLeft === 1 ? "" : "e"}{minutes}.{t.nextPlan ? ` Danach geht es mit „${t.nextPlan.name}“ weiter.` : ""}</>}
        </span>
      </span>
      {isTenantAdmin && (!t.nextPlan || t.ended) && <Link href="/settings/plan#testphase" className="btn-ghost py-1 text-xs">{t.ended ? "Jetzt Paket wählen" : "Paket wählen"}</Link>}
    </div>
  );
}
