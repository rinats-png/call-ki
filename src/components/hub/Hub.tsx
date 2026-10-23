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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <LiveDot color={error ? "amber" : "emerald"} />
            {error ? "Verbindung unterbrochen" : "Live · Aktualisierung alle 5 s"}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">KI-Telefonzentrale</h1>
          <p className="text-sm text-zinc-500">Storm GmbH · Schädlingsbekämpfung</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Integration label="Twilio" ok={i?.twilioConfigured} />
          <Integration label={i?.voiceProvider === "vapi" ? "Vapi" : "Retell AI"} ok={i?.voiceConfigured} ai />
          <Integration label="Outlook" ok={i?.graphConfigured} />
          <button className="btn-primary ml-1" onClick={() => setSimulate(true)}><Plus className="h-4 w-4" />Anruf erfassen</button>
        </div>
      </header>

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

function Integration({ label, ok, ai }: { label: string; ok?: boolean; ai?: boolean }) {
  return (
    <span className={cn("chip px-2.5 py-1 text-xs", ok ? (ai ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200") : "border-zinc-800 bg-zinc-900 text-zinc-500")}>
      <LiveDot color={ok ? (ai ? "cyan" : "emerald") : "zinc"} />
      {label}
      {ok === false && <span className="text-zinc-600">· offline</span>}
    </span>
  );
}
