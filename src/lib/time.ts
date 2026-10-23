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

/**
 * Berechnet freie Slots innerhalb der Geschäftszeiten (Mo–Fr) ab `from`,
 * unter Ausschluss belegter Intervalle.
 */
export function computeFreeSlots(opts: {
  from: Date;
  days: number;
  busy: Interval[];
  durationMin: number;
  startHour: number;
  endHour: number;
  timeZone: string;
  max?: number;
  leadMinutes?: number;
}): Interval[] {
  const { from, days, busy, durationMin, startHour, endHour, timeZone } = opts;
  const max = opts.max ?? 3;
  const earliest = new Date(from.getTime() + (opts.leadMinutes ?? 120) * 60000);
  const slots: Interval[] = [];
  const base = zonedParts(from, timeZone);

  for (let i = 0; i < days && slots.length < max; i++) {
    const dayStart = fromZoned(base.year, base.month, base.day + i, startHour, 0, timeZone);
    const wd = zonedParts(dayStart, timeZone).weekday;
    if (wd === "Sat" || wd === "Sun") continue;
    const dayEnd = fromZoned(base.year, base.month, base.day + i, endHour, 0, timeZone);

    // Auf volle halbe Stunde ab frühestem Zeitpunkt runden
    let cursor = new Date(Math.max(dayStart.getTime(), earliest.getTime()));
    const rem = cursor.getTime() % (30 * 60000);
    if (rem) cursor = new Date(cursor.getTime() + (30 * 60000 - rem));

    while (cursor.getTime() + durationMin * 60000 <= dayEnd.getTime() && slots.length < max) {
      const end = new Date(cursor.getTime() + durationMin * 60000);
      const clash = busy.find((b) => b.start < end && b.end > cursor);
      if (clash) {
        cursor = new Date(Math.max(clash.end.getTime(), cursor.getTime() + 30 * 60000));
        const r = cursor.getTime() % (30 * 60000);
        if (r) cursor = new Date(cursor.getTime() + (30 * 60000 - r));
        continue;
      }
      slots.push({ start: cursor, end });
      // nächster Vorschlag frühestens 2h später für sinnvolle Auswahl
      cursor = new Date(end.getTime() + 60 * 60000);
    }
  }
  return slots;
}
