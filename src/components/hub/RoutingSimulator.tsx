"use client";

import { useEffect, useState } from "react";
import { Route, ArrowRight, PhoneForwarded } from "lucide-react";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABEL, PEST_TYPES, ROLE_LABEL, type EmployeeRole } from "@/lib/constants";
import { cn } from "@/lib/ui";
import { Panel, UrgencyChip } from "./Primitives";

type Preview = {
  urgency: string;
  preferredRole: EmployeeRole;
  reason: string;
  areaMatch: boolean;
  transferRecommended: boolean;
  employee: { name: string; role: string; directPhone: string | null } | null;
  ranked: { id: string; name: string; role: string; score: number }[];
};

export function RoutingSimulator() {
  const [f, setF] = useState({ postalCode: "20095", pestType: "Wespen", customerType: "PRIVATE", description: "" });
  const [res, setRes] = useState<Preview | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const qs = new URLSearchParams(f).toString();
      const r = await fetch(`/api/routing/preview?${qs}`, { cache: "no-store" }).catch(() => null);
      if (r?.ok) setRes(await r.json());
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Panel title={<h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Route className="h-4 w-4 text-cyan-300" />Smart-Routing-Simulator</h2>}>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="PLZ" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={set("postalCode")} />
        <select className="input" value={f.pestType} onChange={set("pestType")}>
          {PEST_TYPES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="input col-span-2" value={f.customerType} onChange={set("customerType")}>
          {CUSTOMER_TYPES.map((c) => <option key={c} value={c}>{CUSTOMER_TYPE_LABEL[c]}</option>)}
        </select>
        <input className="input col-span-2" placeholder="Stichworte, z. B. „Allergiker“, „Restaurantküche“" value={f.description} onChange={set("description")} />
      </div>

      {res && (
        <div className="mt-4 space-y-3 animate-fadein">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <UrgencyChip urgency={res.urgency} />
            <ArrowRight className="h-3 w-3" />
            <span className="chip border-zinc-700 bg-zinc-800/60 text-zinc-300">{ROLE_LABEL[res.preferredRole]}</span>
          </div>
          <div className={cn("rounded-xl border p-3", res.areaMatch ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.06]")}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-100">{res.employee?.name ?? "—"}</span>
              {res.transferRecommended && (
                <span className="chip border-amber-500/40 bg-amber-500/15 text-amber-300"><PhoneForwarded className="h-3 w-3" />Live-Durchstellung</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{res.reason}</p>
          </div>
          <ol className="space-y-1">
            {res.ranked.slice(0, 4).map((r, i) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                <span className={cn(i === 0 ? "text-zinc-200" : "text-zinc-500")}>{i + 1}. {r.name}</span>
                <span className="font-mono tabular-nums text-zinc-600">{r.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
