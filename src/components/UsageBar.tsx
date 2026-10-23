import { cn } from "@/lib/ui";

/** Verbrauchsbalken: Anteil am Kontingent, ab 80 % gelb, ab 100 % rot */
export function UsageBar({ used, included, unit = "Min.", className }: { used: number; included: number; unit?: string; className?: string }) {
  const pct = included > 0 ? Math.min(100, (used / included) * 100) : used > 0 ? 100 : 0;
  const over = included > 0 && used > included;
  const color = over ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-zinc-300"><b className="text-zinc-50">{fmt(used)}</b> von {included > 0 ? fmt(included) : "–"} {unit}</span>
        <span className={cn(over ? "text-rose-300" : pct >= 80 ? "text-amber-300" : "text-zinc-500")}>{included > 0 ? `${Math.round((used / included) * 100)} %` : ""}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      {over && <div className="mt-1 text-[11px] text-rose-300">{fmt(used - included)} {unit} über dem Kontingent</div>}
    </div>
  );
}
const fmt = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(n);
