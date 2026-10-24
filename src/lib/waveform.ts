/**
 * Hilfsfunktionen für die Wellenform-Anzeige von Gesprächsaufnahmen.
 * Rein rechnerisch (kein DOM), damit sie testbar sind.
 */

/** Spitzenwerte je Balken (0–1). Leicht gestaucht (Wurzel), damit leise Passagen sichtbar bleiben. */
export function computePeaks(channels: Float32Array[], bars: number): number[] {
  const len = channels[0]?.length ?? 0;
  if (!len || bars <= 0) return Array.from({ length: Math.max(0, bars) }, () => 0);
  const block = len / bars;
  const raw: number[] = [];
  for (let b = 0; b < bars; b++) {
    const start = Math.floor(b * block);
    const end = Math.max(start + 1, Math.floor((b + 1) * block));
    let peak = 0;
    for (const ch of channels) {
      for (let i = start; i < end && i < len; i++) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
    }
    raw.push(peak);
  }
  const max = Math.max(...raw);
  if (max <= 0) return raw.map(() => 0);
  return raw.map((v) => Math.sqrt(v / max));
}

/** Gleichbleibende Platzhalter-Welle aus einer ID (vor dem Laden der Aufnahme). */
export function placeholderPeaks(seed: string, bars: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const noise = (h % 1000) / 1000;
    const envelope = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI * 3 + (seed.length % 5));
    out.push(Math.max(0.12, Math.min(1, 0.25 + noise * 0.5 * envelope + envelope * 0.25)));
  }
  return out;
}

/** 83 → „1:23“ */
export function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
