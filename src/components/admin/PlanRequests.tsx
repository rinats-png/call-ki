"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { apiFetch } from "@/components/session";

type Req = { id: string; tenantName: string; currentPlan: string; planName: string; note: string; createdAt: string };

/** Offene Paketwechsel-Anfragen der Kunden – annehmen stellt das Paket sofort um. */
export function PlanRequests() {
  const { data, reload } = usePoll<Req[]>("/api/admin/plan-requests", 60_000);
  const [err, setErr] = useState("");
  if (!data?.length) return null;
  const decide = async (id: string, action: "approve" | "reject") => {
    setErr("");
    try {
      await apiFetch(`/api/admin/plan-requests/${id}`, { method: "PATCH", json: { action } });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <section className="glass p-4" aria-label="Offene Paketwechsel">
      <h2 className="mb-2 text-sm font-bold text-zinc-100">Paketwechsel angefragt ({data.length})</h2>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.id} className="glass-soft flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-zinc-100">{r.tenantName}</div>
              <div className="text-zinc-400">{r.currentPlan} → <b className="text-zinc-200">{r.planName}</b> · {new Date(r.createdAt).toLocaleDateString("de-DE")}</div>
              {r.note && <div className="mt-1 text-xs text-zinc-500">„{r.note}“</div>}
            </div>
            <button className="btn-primary py-1.5 text-xs" onClick={() => decide(r.id, "approve")}><Check className="h-4 w-4" />Umstellen</button>
            <button className="btn-ghost py-1.5 text-xs" onClick={() => decide(r.id, "reject")}><X className="h-4 w-4" />Ablehnen</button>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-xs text-amber-300">{err}</p>}
    </section>
  );
}
