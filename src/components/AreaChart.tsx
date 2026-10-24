/**
 * Weiches Flächendiagramm im Glas-Stil (SVG, ohne Bibliothek): leuchtende Linie, getönte Fläche,
 * gestrichelte Hilfslinien, optional eine zweite (warme) Linie und eine Markierung am Höchstwert.
 */
type Point = { label: string; value: number };

function smooth(values: number[], max: number) {
  const n = values.length;
  if (!n) return "";
  const step = n > 1 ? 600 / (n - 1) : 0;
  const pts = values.map((v, i) => [i * step, 150 - (v / max) * 128] as const);
  let d = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

export function AreaChart({ data, secondary, height = 150, unit = "", ariaLabel, onHero, marker = true }: {
  data: Point[]; secondary?: number[]; height?: number; unit?: string; ariaLabel: string; onHero?: boolean; marker?: boolean;
}) {
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value), ...(secondary ?? []));
  const fmt = (v: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(v);
  const line = smooth(data.map((d) => d.value), max);
  const line2 = secondary && secondary.length === n ? smooth(secondary, max) : "";
  const total = data.reduce((a, d) => a + d.value, 0);
  const peak = n ? data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0) : -1;
  const px = n > 1 ? (peak / (n - 1)) * 100 : 50;
  const py = peak >= 0 ? ((150 - (data[peak].value / max) * 128) / 160) * 100 : 0;
  const showMarker = marker && !onHero && peak >= 0 && data[peak].value > 0;
  const labels = n <= 14 ? data.map((d) => d.label) : [data[0]?.label, data[Math.floor(n / 2)]?.label, data[n - 1]?.label];

  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div className="relative">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" style={{ height }} className="block w-full" role="img" aria-label={`${ariaLabel} – gesamt ${fmt(total)}${unit ? ` ${unit}` : ""}`}>
          {!onHero && [40, 80, 120].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="stroke-zinc-700/50" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />)}
          {showMarker && <line x1={(px / 100) * 600} x2={(px / 100) * 600} y1={(py / 100) * 160} y2="160" className="stroke-cyan-400/50" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          {n > 0 && <path d={`${line} L600,160 L0,160 Z`} className={onHero ? "fill-white/20" : "fill-cyan-400/15"} />}
          {line2 && <path d={line2} fill="none" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-amber-400/80" />}
          {n > 0 && <path d={line} fill="none" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={onHero ? "stroke-white" : "stroke-cyan-400"} style={{ filter: "drop-shadow(0 0 6px rgb(var(--acg) / var(--acg-alpha)))" }} />}
        </svg>
        {showMarker && (
          <>
            <span aria-hidden className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400" style={{ left: `${px}%`, top: `${py}%`, boxShadow: "0 0 0 5px rgb(var(--a-400) / 0.18), 0 0 18px rgb(var(--acg) / var(--acg-alpha))" }} />
            <span className="glass-soft absolute -translate-x-1/2 whitespace-nowrap px-2.5 py-1 text-[11px] font-bold text-zinc-100" style={{ left: `${Math.min(88, Math.max(12, px))}%`, top: `calc(${py}% - 38px)` }}>
              {data[peak].label} · {fmt(data[peak].value)}{unit ? ` ${unit}` : ""}
            </span>
          </>
        )}
      </div>
      {!onHero && (
        <figcaption className="mt-1.5 flex justify-between text-[11px] text-zinc-500">
          {labels.map((l, i) => <span key={i}>{l}</span>)}
        </figcaption>
      )}
    </figure>
  );
}
