import type { DashboardData } from "./types";
import { Panel } from "./Primitives";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function WeekChart({ week }: { week: DashboardData["week"] }) {
  const max = Math.max(1, ...week.map((d) => d.total));
  const total = week.reduce((a, d) => a + d.total, 0);
  return (
    <Panel title="Anrufvolumen · 7 Tage" action={<span className="text-xs tabular-nums text-zinc-500">{total} Anrufe</span>}>
      <div className="flex items-end gap-2">
        {week.map((d) => {
          const day = WD[new Date(d.date + "T12:00:00").getDay()];
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5" title={`${d.date}: ${d.total} Anrufe, ${d.critical} dringend`}>
              <div className="relative flex h-24 w-full items-end">
                <div className="w-full rounded-md bg-gradient-to-t from-cyan-500/30 to-cyan-400/70 transition-all group-hover:from-cyan-400/50 group-hover:to-cyan-300" style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}>
                  {d.critical > 0 && <div className="w-full rounded-t-md bg-amber-400/90" style={{ height: `${(d.critical / Math.max(d.total, 1)) * 100}%` }} />}
                </div>
              </div>
              <span className="text-[10px] text-zinc-500">{day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-cyan-400" />Gesamt</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-400" />Hoch / Notfall</span>
      </div>
    </Panel>
  );
}
