import { PhoneIncoming, Siren, CalendarCheck, UserPlus, Timer } from "lucide-react";
import { cn } from "@/lib/ui";
import type { DashboardData } from "./types";
import { Skeleton } from "./Primitives";

export function KpiCards({ data }: { data: DashboardData | null }) {
  const s = data?.stats;
  const limit = s?.minuteLimit;
  const usage = s && limit ? Math.round((s.minutesThisMonth / limit) * 100) : null;
  const cards = [
    { label: "Anrufe heute", value: s?.callsToday, icon: PhoneIncoming, tone: "cyan", sub: s ? `${s.todayCount} Vorgänge · ${s.pendingCount} offen` : "" },
    { label: "Notfälle offen", value: s?.escalatedOpen, icon: Siren, tone: s && s.escalatedOpen > 0 ? "amber" : "zinc", sub: "Eskaliert an Notdienst" },
    { label: "Termine heute vergeben", value: s?.plannedToday, icon: CalendarCheck, tone: "emerald", sub: s ? (s.automationRate == null ? "–" : `${s.automationRate}% der Vorgänge`) : "" },
    { label: "Neukunden heute", value: s?.newCustomersToday, icon: UserPlus, tone: "cyan", sub: s ? `${s.totalCustomers} Kunden gesamt` : "" },
    { label: "Minuten im Monat", value: s?.minutesThisMonth, icon: Timer, tone: usage != null && usage >= 90 ? "amber" : "emerald", sub: limit ? `von ${limit} (${usage}%)` : "ohne Limit" },
  ] as const;

  const tones = {
    cyan: "text-cyan-300 bg-cyan-400/10 ring-cyan-400/20",
    emerald: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20",
    amber: "text-amber-300 bg-amber-400/15 ring-amber-400/30",
    zinc: "text-zinc-400 bg-zinc-800 ring-zinc-700",
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((c, i) => (
        <div key={c.label} className={cn("glass relative overflow-hidden p-4 animate-fadein", c.tone === "amber" && "border-amber-500/30")} style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-start justify-between gap-2">
            <span className="label">{c.label}</span>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1", tones[c.tone])}>
              <c.icon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-4xl font-extrabold tabular-nums tracking-tight text-zinc-50">
            {c.value === undefined ? <Skeleton className="h-8 w-14" /> : c.value}
          </div>
          <div className="mt-1 truncate text-xs text-zinc-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
