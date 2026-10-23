/** Weiches Flächendiagramm (SVG, ohne Bibliothek) – Linie in Akzentfarbe, Fläche leicht getönt. */
export function AreaChart({ data, height = 130, unit = "", ariaLabel, onHero }: { data: { label: string; value: number }[]; height?: number; unit?: string; ariaLabel: string; onHero?: boolean }) {
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(v);
  let line = "";
  if (n > 0) {
    const step = n > 1 ? 600 / (n - 1) : 0;
    const pts = data.map((d, i) => [i * step, 120 - (d.value / max) * 104] as const);
    line = `M${pts[0][0]},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      line += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
  }
  const area = `${line} L600,130 L0,130 Z`;
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure aria-label={ariaLabel} className="w-full">
      <svg viewBox="0 0 600 130" preserveAspectRatio="none" style={{ height }} className="w-full" role="img" aria-label={`${ariaLabel} – gesamt ${fmt(total)}${unit ? ` ${unit}` : ""}`}>
        {n > 0 && <path d={area} className={onHero ? "fill-white/20" : "fill-cyan-400/15"} />}
        {n > 0 && <path d={line} fill="none" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={onHero ? "stroke-white" : "stroke-cyan-400"} />}
      </svg>
      {!onHero && (
        <figcaption className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>{data[0]?.label}</span>
          <span>{data[n - 1]?.label}</span>
        </figcaption>
      )}
    </figure>
  );
}
