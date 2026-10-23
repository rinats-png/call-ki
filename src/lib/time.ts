/**
 * Zeitzonen-Helfer ohne externe Abhängigkeiten. Graph erwartet lokale
 * Zeitangaben ("2026-10-24T09:00:00") plus Zeitzonenname.
 */
export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
    weekday: p.weekday as string,
  };
}

/** Offset der Zeitzone zum Zeitpunkt `date` in Minuten (z. B. +60 / +120 für Berlin). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Erzeugt den UTC-Zeitpunkt für eine lokale Wanduhrzeit in `timeZone`. */
export function fromZoned(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off1 = tzOffsetMinutes(guess, timeZone);
  const t = new Date(guess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(t, timeZone);
  return off1 === off2 ? t : new Date(guess.getTime() - off2 * 60000);
}

/** "YYYY-MM-DDTHH:mm:ss" in lokaler Zeit der Zone – Format für Graph dateTimeTimeZone. */
export function toGraphLocal(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

export function formatGermanDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone, weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(date) + " Uhr";
}

export type Interval = { start: Date; end: Date };

const ISO_DAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Freie Slots innerhalb der Geschäftszeiten ab `from`. Belegte Intervalle werden
 * um `bufferMin` (Anfahrt/Puffer) erweitert.
 */
export function computeFreeSlots(opts: {
  from: Date;
  days: number;
  busy: Interval[];
  durationMin: number;
  timeZone: string;
  /** ISO-Wochentage (1 = Mo … 7 = So) */
  workDays?: number[];
  start?: string; // "08:00"
  end?: string; // "18:00"
  bufferMin?: number;
  max?: number;
  leadMinutes?: number;
  /** Abstand zwischen zwei angebotenen Slots */
  spreadMin?: number;
}): Interval[] {
  const { from, days, durationMin, timeZone } = opts;
  const workDays = opts.workDays ?? [1, 2, 3, 4, 5];
  const startMin = toMin(opts.start ?? "08:00");
  const endMin = toMin(opts.end ?? "18:00");
  const buffer = (opts.bufferMin ?? 0) * 60000;
  const max = opts.max ?? 3;
  const step = 30 * 60000;
  const earliest = new Date(from.getTime() + (opts.leadMinutes ?? 120) * 60000);
  const busy = opts.busy.map((b) => ({ start: new Date(b.start.getTime() - buffer), end: new Date(b.end.getTime() + buffer) }));
  const slots: Interval[] = [];
  const base = zonedParts(from, timeZone);
  const roundUp = (d: Date) => {
    const r = d.getTime() % step;
    return r ? new Date(d.getTime() + (step - r)) : d;
  };

  for (let i = 0; i <= days && slots.length < max; i++) {
    const dayStart = fromZoned(base.year, base.month, base.day + i, Math.floor(startMin / 60), startMin % 60, timeZone);
    if (!workDays.includes(ISO_DAY[zonedParts(dayStart, timeZone).weekday])) continue;
    const dayEnd = fromZoned(base.year, base.month, base.day + i, Math.floor(endMin / 60), endMin % 60, timeZone);

    let cursor = roundUp(new Date(Math.max(dayStart.getTime(), earliest.getTime())));
    while (cursor.getTime() + durationMin * 60000 <= dayEnd.getTime() && slots.length < max) {
      const end = new Date(cursor.getTime() + durationMin * 60000);
      const clash = busy.find((b) => b.start < end && b.end > cursor);
      if (clash) {
        cursor = roundUp(new Date(Math.max(clash.end.getTime(), cursor.getTime() + step)));
        continue;
      }
      slots.push({ start: cursor, end });
      cursor = roundUp(new Date(end.getTime() + (opts.spreadMin ?? 60) * 60000));
    }
  }
  return slots;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}
