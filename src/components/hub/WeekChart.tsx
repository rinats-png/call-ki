import type { DashboardData } from "./types";
import { Panel } from "./Primitives";
import { AreaChart } from "../AreaChart";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function WeekChart({ week }: { week: DashboardData["week"] }) {
  const total = week.reduce((a, d) => a + d.total, 0);
  return (
    <Panel
      title={<div><h2 className="text-sm font-bold text-zinc-100">Anrufe · letzte 7 Tage</h2><p className="text-[11px] text-zinc-500">{total} Anrufe, davon {week.reduce((a, d) => a + d.critical, 0)} dringend oder Notfall</p></div>}
      action={<span className="flex items-center gap-3 text-[11px] text-zinc-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400 glow-accent" />Anrufe</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Dringend</span></span>}
    >
      <AreaChart ariaLabel="Anrufe der letzten 7 Tage" unit="Anrufe" height={190} secondary={week.map((d) => d.critical)} data={week.map((d) => ({ label: WD[new Date(d.date + "T12:00:00").getDay()], value: d.total }))} />
    </Panel>
  );
}
