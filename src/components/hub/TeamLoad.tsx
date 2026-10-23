import { ROLE_LABEL, type EmployeeRole } from "@/lib/constants";
import { cn } from "@/lib/ui";
import type { EmployeeRow } from "./types";
import { Panel } from "./Primitives";

export function TeamLoad({ employees }: { employees: EmployeeRow[] }) {
  const max = Math.max(5, ...employees.map((e) => e.openTickets));
  return (
    <Panel title="Team-Auslastung">
      <ul className="space-y-3">
        {employees.map((e) => {
          const pct = (e.openTickets / max) * 100;
          return (
            <li key={e.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300 ring-1 ring-zinc-700">
                    {e.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </span>
                  <span className="truncate text-zinc-200">{e.name}</span>
                  <span className="hidden truncate text-[11px] text-zinc-500 sm:inline">{ROLE_LABEL[e.role as EmployeeRole] ?? e.role}</span>
                </span>
                <span className="tabular-nums text-xs text-zinc-400">{e.openTickets}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className={cn("h-full rounded-full transition-all", pct > 70 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${Math.max(pct, 3)}%` }} />
              </div>
            </li>
          );
        })}
        {employees.length === 0 && <li className="text-sm text-zinc-500">Keine Mitarbeiter angelegt.</li>}
      </ul>
    </Panel>
  );
}
