"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { CUSTOMER_TYPE_LABEL, type CustomerType } from "@/lib/constants";
import { fmtDateTime } from "@/lib/ui";
import { Panel, Skeleton } from "@/components/hub/Primitives";

type Row = {
  id: string; name: string | null; companyName: string | null; phone: string; email: string | null;
  address: string | null; postalCode: string | null; customerType: string; status: string; updatedAt: string;
  _count: { tickets: number }; tickets: { createdAt: string; pestType: string | null }[];
};

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setD(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = usePoll<Row[]>(`/api/customers${d ? `?q=${encodeURIComponent(d)}` : ""}`, 15000);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Kunden</h1>
        <p className="text-sm text-zinc-500">Automatisch erkannt über die Rufnummer des Anrufers.</p>
      </header>
      <Panel
        title={<span className="text-sm text-zinc-400">{data ? `${data.length} Einträge` : "Lade…"}</span>}
        action={
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input className="input py-1.5 pl-8 text-xs" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3 font-medium">Kunde</th>
                <th className="py-2 pr-3 font-medium">Kontakt</th>
                <th className="py-2 pr-3 font-medium">Adresse</th>
                <th className="py-2 pr-3 font-medium">Typ</th>
                <th className="py-2 pr-3 font-medium">Vorgänge</th>
                <th className="py-2 font-medium">Letzter Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {!data && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="py-2"><Skeleton className="h-8" /></td></tr>
              ))}
              {data?.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/60 transition hover:bg-zinc-800/30">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{c.companyName ?? c.name ?? "Unbekannt"}</span>
                      {c.status === "NEW" && <span className="chip border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Neu</span>}
                    </div>
                    {c.companyName && c.name && <div className="text-xs text-zinc-500">{c.name}</div>}
                  </td>
                  <td className="py-3 pr-3 text-zinc-300">
                    <div className="font-mono text-xs">{c.phone}</div>
                    <div className="text-xs text-zinc-500">{c.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-zinc-400">{[c.address, c.postalCode].filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-3 pr-3 text-xs text-zinc-400">{CUSTOMER_TYPE_LABEL[c.customerType as CustomerType] ?? c.customerType}</td>
                  <td className="py-3 pr-3 tabular-nums text-zinc-300">{c._count.tickets}</td>
                  <td className="py-3 text-xs text-zinc-500">
                    {c.tickets[0] ? <>{fmtDateTime(c.tickets[0].createdAt)} · {c.tickets[0].pestType}</> : "—"}
                  </td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Keine Kunden gefunden.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
