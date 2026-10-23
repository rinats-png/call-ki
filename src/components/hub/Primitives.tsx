import { cn, STATUS_STYLE, URGENCY_STYLE } from "@/lib/ui";

export function LiveDot({ color = "emerald", className }: { color?: "emerald" | "cyan" | "amber" | "zinc"; className?: string }) {
  const c = { emerald: "bg-emerald-400", cyan: "bg-cyan-400", amber: "bg-amber-400", zinc: "bg-zinc-600" }[color];
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      {color !== "zinc" && <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping2", c)} />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", c)} />
    </span>
  );
}

export function UrgencyChip({ urgency }: { urgency: string }) {
  const s = URGENCY_STYLE[urgency] ?? URGENCY_STYLE.MEDIUM;
  return (
    <span className={cn("chip", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return <span className={cn("chip", s.chip)}>{s.label}</span>;
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass p-4 md:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {typeof title === "string" ? <h2 className="text-sm font-semibold text-zinc-200">{title}</h2> : title}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-800/60", className)} />;
}
