/** Ruhiges Teal-Band oben auf einer Seite: Titel, eine große Kennzahl und bis zu drei Nebenwerte. */
export function PageHero({ eyebrow, title, value, valueLabel, stats, action }: {
  eyebrow?: string; title: string; value: React.ReactNode; valueLabel?: string;
  stats?: { label: string; value: React.ReactNode }[]; action?: React.ReactNode;
}) {
  return (
    <section className="hero grid gap-5 p-5 md:px-8 md:py-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <div className="text-sm opacity-90">{eyebrow}</div>}
            <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
          </div>
          {action && <div className="lg:hidden">{action}</div>}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="text-5xl font-extrabold leading-none tracking-tight tabular-nums">{value}</span>
          {valueLabel && <span className="text-base opacity-90">{valueLabel}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {action && <div className="hidden justify-end lg:flex">{action}</div>}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/15 px-2 py-3">
                <div className="text-2xl font-extrabold tabular-nums md:text-3xl">{s.value}</div>
                <div className="text-xs opacity-90">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Heller Button auf dem Teal-Band */
export const heroBtn = "inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--hero-from))] transition hover:bg-white/90";
