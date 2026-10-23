export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const URGENCY_STYLE: Record<string, { label: string; dot: string; chip: string; bar: string }> = {
  LOW: { label: "Niedrig", dot: "bg-zinc-500", chip: "border-zinc-700 bg-zinc-800/60 text-zinc-300", bar: "bg-zinc-600" },
  MEDIUM: { label: "Mittel", dot: "bg-cyan-400", chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300", bar: "bg-cyan-400" },
  HIGH: { label: "Hoch", dot: "bg-amber-400", chip: "border-amber-500/30 bg-amber-500/10 text-amber-300", bar: "bg-amber-400" },
  CRITICAL: { label: "Notfall", dot: "bg-amber-500", chip: "border-amber-500/50 bg-amber-500/20 text-amber-200 shadow-sm", bar: "bg-amber-500" },
};

export const STATUS_STYLE: Record<string, { label: string; chip: string }> = {
  PENDING: { label: "Offen", chip: "border-zinc-700 bg-zinc-800/60 text-zinc-300" },
  PROCESSED: { label: "Erledigt", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  ESCALATED: { label: "Eskaliert", chip: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
};

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`;
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));
}
