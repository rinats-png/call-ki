/**
 * Seitenkopf im Glas-Stil: Titel links, Kennzahlen als Glas-Pille rechts (wie im Entwurf G01–G13).
 * „value“ ist die wichtigste Kennzahl und steht als erste in der Pille.
 */
export function PageHero({ eyebrow, title, value, valueLabel, stats, action }: {
  eyebrow?: string; title: React.ReactNode; value?: React.ReactNode; valueLabel?: string;
  stats?: { label: string; value: React.ReactNode }[]; action?: React.ReactNode;
}) {
  const pills = [...(value !== undefined ? [{ label: valueLabel ?? "", value }] : []), ...(stats ?? [])];
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50 md:text-[26px]">{title}</h1>
        {eyebrow && <p className="text-sm text-zinc-500">{eyebrow}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pills.length > 0 && (
          <div className="stat-pill">
            {pills.map((s, i) => (
              <div key={s.label + i} className="flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3.5">
                <span className={i === 0 ? "h-2 w-2 rounded-full bg-cyan-400 glow-accent" : "h-2 w-2 rounded-full bg-zinc-600"} />
                <span className="leading-tight">
                  <span className="block whitespace-nowrap text-[10px] text-zinc-500">{s.label}</span>
                  <b className="block whitespace-nowrap text-sm tabular-nums text-zinc-50">{s.value}</b>
                </span>
              </div>
            ))}
          </div>
        )}
        {action}
      </div>
    </header>
  );
}

/** Hauptaktion im Seitenkopf */
export const heroBtn = "btn-primary";
