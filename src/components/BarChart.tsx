/** Schlanker Säulendiagramm-Baustein (SVG, ohne Bibliothek), barrierearm mit Titeln je Säule. */
export function BarChart({ data, height = 140, unit = "", highlightLast = false, ariaLabel }: { data: { label: string; value: number }[]; height?: number; unit?: string; highlightLast?: boolean; ariaLabel: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const fmt = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(n);
  return (
    <figure aria-label={ariaLabel} className="w-full">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-[140px] w-full" role="img" aria-label={ariaLabel}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2="100" y1={height * f} y2={height * f} className="stroke-zinc-800" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 6);
          const last = highlightLast && i === data.length - 1;
          return (
            <rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={Math.max(h, d.value > 0 ? 1.5 : 0)} rx="0.8" className={last ? "fill-cyan-400" : "fill-emerald-400/70"}>
              <title>{`${d.label}: ${fmt(d.value)}${unit ? ` ${unit}` : ""}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
