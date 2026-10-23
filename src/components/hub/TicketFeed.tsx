"use client";

import { CalendarCheck, Mail, Search } from "lucide-react";
import type { CustomerType } from "@/lib/constants";
import { cn, timeAgo, URGENCY_STYLE } from "@/lib/ui";
import { useSession } from "../session";
import type { TicketRow } from "./types";
import { Panel, Skeleton, StatusChip, UrgencyChip } from "./Primitives";

const STATUS_FILTERS = [
  { v: "", l: "Alle" },
  { v: "PENDING", l: "Offen" },
  { v: "ESCALATED", l: "Eskaliert" },
  { v: "PROCESSED", l: "Eingeplant" },
  { v: "CLOSED", l: "Erledigt" },
];

export function TicketFeed(props: {
  tickets: TicketRow[] | null;
  status: string;
  onStatus: (s: string) => void;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  selectedId: string | null;
  now: number;
}) {
  const { tickets } = props;
  const { me } = useSession();
  const typeLabel = (t: string) => me?.tenant?.customerTypeLabels[t as CustomerType] ?? t;
  return (
    <Panel
      className="flex min-h-[420px] flex-col"
      title={
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Vorgänge</h2>
          {tickets && <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-400">{tickets.length}</span>}
        </div>
      }
      action={
        <div className="relative w-40 sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input className="input py-1.5 pl-8 text-xs" placeholder="Name, PLZ, Nummer…" value={props.query} onChange={(e) => props.onQuery(e.target.value)} />
        </div>
      }
    >
      <div className="mb-3 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.v}
            onClick={() => props.onStatus(f.v)}
            className={cn("flex-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-xs font-medium transition", props.status === f.v ? "bg-zinc-800 text-zinc-100 shadow" : "text-zinc-500 hover:text-zinc-300")}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="-mx-2 flex-1 space-y-1 overflow-y-auto px-2" style={{ maxHeight: 620 }}>
        {!tickets && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        {tickets?.length === 0 && (
          <div className="grid h-48 place-items-center text-center text-sm text-zinc-500">Keine Vorgänge für diesen Filter.<br />Neue Anrufe erscheinen hier automatisch.</div>
        )}
        {tickets?.map((t) => {
          const u = URGENCY_STYLE[t.urgency] ?? URGENCY_STYLE.MEDIUM;
          const who = t.customer.companyName ?? t.customer.name ?? t.customer.phone;
          return (
            <button
              key={t.id}
              onClick={() => props.onOpen(t.id)}
              className={cn(
                "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left transition animate-fadein",
                props.selectedId === t.id ? "border-cyan-500/40 bg-cyan-500/[0.06]" : "border-transparent hover:border-zinc-800 hover:bg-zinc-800/40",
              )}
            >
              <span className={cn("absolute inset-y-2 left-0 w-0.5 rounded-full", u.bar)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-zinc-100">{who}</span>
                  {t.customer.status === "NEW" && <span className="chip border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Neu</span>}
                  <span className="hidden text-[11px] text-zinc-500 sm:inline">{typeLabel(t.customer.customerType)}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">
                  <span className="text-zinc-300">{t.category ?? "Sonstiges"}</span>
                  {t.customer.postalCode && <> · PLZ {t.customer.postalCode}</>}
                  {t.assignedEmployee && <> · → {t.assignedEmployee.name}</>}
                  {t.summary && <> · {t.summary}</>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <CalendarCheck className={cn("h-3.5 w-3.5", t.appointmentStart ? "text-emerald-400" : "text-zinc-600/50")} aria-label={t.appointmentStart ? "Termin vergeben" : "Kein Termin"} />
                  <Mail className={cn("h-3.5 w-3.5", t.messageCount ? "text-emerald-400" : "text-zinc-600/50")} aria-label={`${t.messageCount} Benachrichtigungen`} />
                  <UrgencyChip urgency={t.urgency} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">{timeAgo(t.createdAt, props.now)}</span>
                  <StatusChip status={t.status} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
