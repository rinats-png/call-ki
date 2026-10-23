import type { DashboardData } from "./types";
import { Panel } from "./Primitives";
import { AreaChart } from "../AreaChart";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function WeekChart({ week }: { week: DashboardData["week"] }) {
  const total = week.reduce((a, d) => a + d.total, 0);
  return (
    <Panel title="Anrufvolumen · 7 Tage" action={<span className="text-xs tabular-nums text-zinc-500">{total} Anrufe</span>}>
      <AreaChart ariaLabel="Anrufe der letzten 7 Tage" unit="Anrufe" data={week.map((d) => ({ label: WD[new Date(d.date + "T12:00:00").getDay()], value: d.total }))} />
      <p className="mt-2 text-[11px] text-zinc-500">{week.reduce((a, d) => a + d.critical, 0)} davon dringend oder Notfall</p>
    </Panel>
  );
}
