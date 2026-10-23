"use client";

import { useEffect, useState } from "react";
import { Route, ArrowRight, PhoneForwarded } from "lucide-react";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { cn } from "@/lib/ui";
import { useSession } from "../session";
import { Panel, UrgencyChip } from "./Primitives";

type Preview = {
  urgency: string;
  preferredRole: string;
  reason: string;
  areaMatch: boolean;
  transferRecommended: boolean;
  employee: { name: string; role: string; directPhone: string | null } | null;
  ranked: { id: string; name: string; role: string; score: number }[];
};

export function RoutingSimulator() {
  const { me } = useSession();
  const t = me?.tenant;
  const [f, setF] = useState({ postalCode: "", category: "", customerType: "PRIVATE", description: "" });
  const [res, setRes] = useState<Preview | null>(null);

  useEffect(() => {
    if (t && !f.category) setF((x) => ({ ...x, category: t.categories[0] ?? "" }));
  }, [t, f.category]);

  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/routing/preview?${new URLSearchParams(f)}`, { cache: "no-store" }).catch(() => null);
      if (r?.ok) setRes(await r.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [f, t]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Route className="h-4 w-4 text-cyan-300" />Routing-Simulator</h2>}>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="PLZ" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={set("postalCode")} aria-label="PLZ" />
        <select className="input" value={f.category} onChange={set("category")} aria-label="Anliegen">
          {t?.categories.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="input col-span-2" value={f.customerType} onChange={set("customerType")} aria-label="Kundentyp">
          {CUSTOMER_TYPES.map((c) => <option key={c} value={c}>{t?.customerTypeLabels[c] ?? c}</option>)}
        </select>
        <input className="input col-span-2" placeholder="Stichworte aus dem Gespräch" value={f.description} onChange={set("description")} aria-label="Stichworte" />
      </div>

      {res && (
        <div className="mt-4 space-y-3 animate-fadein">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <UrgencyChip urgency={res.urgency} />
            <ArrowRight className="h-3 w-3" />
            <span className="chip border-zinc-700 bg-zinc-800/60 text-zinc-300">{t?.roleLabels[res.preferredRole as keyof typeof t.roleLabels] ?? res.preferredRole}</span>
          </div>
          <div className={cn("rounded-xl border p-3", res.employee ? (res.areaMatch ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]") : "border-zinc-700")}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-100">{res.employee?.name ?? "Niemand verfügbar"}</span>
              {res.transferRecommended && (
                <span className="chip border-amber-500/40 bg-amber-500/15 text-amber-300"><PhoneForwarded className="h-3 w-3" />Durchstellung</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{res.reason}</p>
          </div>
        </div>
      )}
    </Panel>
  );
}
