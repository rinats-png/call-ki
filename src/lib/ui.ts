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
  PROCESSED: { label: "Eingeplant", chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  ESCALATED: { label: "Eskaliert", chip: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  CLOSED: { label: "Erledigt", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

export const MESSAGE_STATUS: Record<string, { label: string; chip: string }> = {
  SENT: { label: "Gesendet", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  DRAFT: { label: "Entwurf", chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  QUEUED: { label: "Wartend", chip: "border-zinc-700 bg-zinc-800 text-zinc-400" },
  SKIPPED: { label: "Nicht versendet", chip: "border-zinc-700 bg-zinc-800 text-zinc-400" },
  FAILED: { label: "Fehler", chip: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
};

export const PURPOSE_LABEL: Record<string, string> = {
  CUSTOMER_CONFIRMATION: "Kundenbestätigung",
  TECHNICIAN_BRIEFING: "Info an Mitarbeiter",
  EMERGENCY_ALERT: "Notfall-Alarm",
  BACKOFFICE_COPY: "Kopie Büro",
  INVITE: "Einladung",
  PASSWORD_RESET: "Passwort-Reset",
};

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return "–";
  const m = Math.floor(sec / 60);
  return m ? `${m}:${String(sec % 60).padStart(2, "0")} min` : `${sec} s`;
}

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

export const TENANT_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  ONBOARDING: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  PAUSED: "border-amber-500/40 bg-amber-500/15 text-amber-300",
};
export const TENANT_STATUS_LABEL: Record<string, string> = { ACTIVE: "Aktiv", ONBOARDING: "Einrichtung", PAUSED: "Pausiert" };

/** Cent → „12,90 €“ */
export function eur(cents: number | null | undefined, opts: { decimals?: number } = {}) {
  const d = opts.decimals ?? 2;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: d, maximumFractionDigits: d }).format((cents ?? 0) / 100);
}

/** „12,90“ (Eingabe in Euro) → 1290 Cent; leer → null */
export function parseEuro(v: string): number | null {
  const t = v.trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
