"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { eur } from "@/lib/ui";
import { usePoll } from "@/lib/use-poll";
import { Panel } from "@/components/hub/Primitives";
import { apiFetch } from "@/components/session";

type Row = { id: string; number: string; year: number; month: number; issuedAt: string; grossCents: number; partial: boolean };
type Address = { name: string; billingAddress: string | null; billingVatId: string | null };

/** Kunden-Admin: ausgestellte Rechnungen und Rechnungsanschrift. */
export function InvoicesPanel() {
  const { data } = usePoll<Row[]>("/api/invoices", 0);
  const { data: addr } = usePoll<Address>("/api/billing/address", 0);
  const [address, setAddress] = useState("");
  const [vatId, setVatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (addr) {
      setAddress(addr.billingAddress ?? "");
      setVatId(addr.billingVatId ?? "");
    }
  }, [addr]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-300" />Rechnungen</span>}>
        {!data ? null : data.length === 0 ? (
          <p className="text-sm text-zinc-400">Noch keine Rechnungen. Rechnungen entstehen nach Monatsende (ab dem 3. des Folgemonats).</p>
        ) : (
          <ul className="divide-y divide-zinc-800 text-sm">
            {data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <a className="font-semibold text-cyan-300 hover:underline" href={`/invoice/${r.id}`} target="_blank" rel="noreferrer">{r.number}</a>
                <span className="text-zinc-400">{String(r.month).padStart(2, "0")}/{r.year}{r.partial ? " · Schlussrechnung" : ""}</span>
                <span className="tabular-nums text-zinc-200">{eur(r.grossCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Rechnungsanschrift">
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg("");
          try {
            await apiFetch("/api/billing/address", { method: "PUT", json: { billingAddress: address, billingVatId: vatId } });
            setMsg("Gespeichert – gilt für künftige Rechnungen.");
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <textarea className="input min-h-[90px]" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={400} placeholder={`${addr?.name ?? "Firma"}\nStraße Nr.\nPLZ Ort`} aria-label="Rechnungsanschrift" />
          <input className="input" value={vatId} onChange={(e) => setVatId(e.target.value)} maxLength={30} placeholder="USt-IdNr. (optional)" aria-label="USt-IdNr." />
          <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Speichern</button>
          {msg && <p role="status" className="text-xs text-zinc-400">{msg}</p>}
        </form>
      </Panel>
    </div>
  );
}
