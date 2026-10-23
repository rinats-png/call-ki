"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/ui";
import type { DashboardData } from "./types";
import { KpiCards } from "./KpiCards";
import { TicketFeed } from "./TicketFeed";
import { WeekChart } from "./WeekChart";
import { TeamLoad } from "./TeamLoad";
import { RoutingSimulator } from "./RoutingSimulator";
import { TicketDrawer } from "./TicketDrawer";
import { SimulateCall } from "./SimulateCall";
import { LiveDot } from "./Primitives";
import { UsageHero } from "./UsageHero";

export function Hub() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const qs = new URLSearchParams({ ...(status && { status }), ...(debounced && { q: debounced }) }).toString();
  const { data, error, reload } = usePoll<DashboardData>(`/api/dashboard${qs ? `?${qs}` : ""}`, 5000);
  const i = data?.integrations;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <UsageHero error={!!error} />

      <div className="flex flex-wrap items-center gap-2">
        <Integration label="Rufnummer" ok={i?.phone} />
        <Integration label="KI-Agent" ok={i?.voice} ai />
        <Integration label="Outlook" ok={i?.outlook} optional />
        <Integration label="E-Mail" ok={i?.email} />
        <button className="btn-primary ml-auto" onClick={() => setSimulate(true)}><Plus className="h-4 w-4" />Anruf erfassen</button>
      </div>

      <KpiCards data={data} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TicketFeed
          tickets={data?.tickets ?? null}
          status={status}
          onStatus={setStatus}
          query={query}
          onQuery={setQuery}
          onOpen={setOpen}
          selectedId={open}
          now={now}
        />
        <div className="space-y-5">
          <RoutingSimulator />
          {data && <WeekChart week={data.week} />}
          {data && <TeamLoad employees={data.employees} />}
        </div>
      </div>

      {open && <TicketDrawer id={open} employees={data?.employees ?? []} onClose={() => setOpen(null)} onChanged={reload} />}
      {simulate && (
        <SimulateCall
          onClose={() => setSimulate(false)}
          onCreated={(id) => {
            setSimulate(false);
            reload();
            setOpen(id);
          }}
        />
      )}
    </div>
  );
}

function Integration({ label, ok, ai, optional }: { label: string; ok?: boolean; ai?: boolean; optional?: boolean }) {
  return (
    <span className={cn("chip px-2.5 py-1 text-xs", ok ? (ai ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200") : "border-zinc-800 bg-zinc-900 text-zinc-500")}>
      <LiveDot color={ok ? (ai ? "cyan" : "emerald") : "zinc"} />
      {label}
      {ok === false && <span className="text-zinc-500">· {optional ? "nicht verbunden" : "fehlt"}</span>}
    </span>
  );
}
