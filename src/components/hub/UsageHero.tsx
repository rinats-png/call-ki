"use client";

import Link from "next/link";
import { usePoll } from "@/lib/use-poll";
import { eur } from "@/lib/ui";
import { useSession } from "../session";
import { Skeleton } from "./Primitives";
import { LiveDot } from "./Primitives";

type Data = {
  plan: { name: string; hasPlan: boolean; includedMinutes: number; overageMode: string; overageCentsPerMinute?: number };
  usage: { minutes: number };
  projectedMinutes: number;
  daily: { day: number }[];
};
const nf = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);

/** Großes Verbrauchs-Band oben im Kundenhub: Minuten, Fortschritt, Prognose. */
export function UsageHero({ error }: { error?: boolean }) {
  const { me } = useSession();
  const { data } = usePoll<Data>("/api/billing", 60_000);
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const first = me?.user.name?.split(/\s+/)[0];
  const month = new Date().toLocaleDateString("de-DE", { month: "long", timeZone: "Europe/Berlin" });

  const p = data?.plan;
  const used = data?.usage.minutes ?? 0;
  const incl = p?.hasPlan ? p.includedMinutes : 0;
  const pct = incl > 0 ? Math.min(100, (used / incl) * 100) : 0;
  const daysLeft = data ? Math.max(0, data.daily.length - new Date().getDate()) : 0;
  const over = incl > 0 ? Math.max(0, data!.projectedMinutes - incl) : 0;

  return (
    <section className="hero p-5 md:px-8 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm opacity-90">{me?.tenant?.name ?? "KI-Telefonzentrale"} · {month}</div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{greet}{first ? `, ${first}` : ""}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm opacity-95">
          <LiveDot color={error ? "amber" : "emerald"} />
          {error ? "Verbindung unterbrochen" : "Ihre KI-Assistentin ist erreichbar"}
        </div>
      </div>
      {!data ? (
        <Skeleton className="mt-5 h-24 bg-white/15" />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className="text-5xl font-extrabold leading-none tracking-tight tabular-nums md:text-6xl">{nf(used)}</span>
            <span className="text-lg opacity-90">{incl > 0 ? `von ${nf(incl)} Minuten · Paket ${p!.name}` : "Minuten diesen Monat"}</span>
          </div>
          {incl > 0 && (
            <>
              <div className="relative mt-4 h-4 rounded-full bg-white/25" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Verbrauchte Minuten">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-sm opacity-95">
                Prognose bis Monatsende: <b>{nf(data.projectedMinutes)} Minuten</b>
                {over > 0 ? (p!.overageMode === "BLOCK" ? " – das Kontingent reicht voraussichtlich nicht." : ` – ${nf(over)} Zusatzminuten kosten etwa ${eur(over * (p!.overageCentsPerMinute ?? 0))}.`) : " – im Rahmen Ihres Pakets."} Noch {daysLeft} Tage.{" "}
                <Link href="/settings/plan" className="font-semibold underline underline-offset-2">Details</Link>
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
