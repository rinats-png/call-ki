"use client";

import { useState } from "react";
import { Check, Landmark, Loader2, Upload, X } from "lucide-react";
import { usePoll } from "@/lib/use-poll";
import { Panel } from "@/components/hub/Primitives";
import { InfoTip } from "@/components/InfoTip";
import { apiFetch } from "@/components/session";

type Suggestion = { id: string; bookingDate: string; amountCents: number; counterparty: string; reference: string; reason: string; bill: { id: string; number: string | null; grossCents: number; status: string; customer: { name: string | null; companyName: string | null } } | null };
type Result = { credits: number; matched: { number: string | null; amountCents: number }[]; suggested: number; unmatched: number; duplicates: number };

const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Datei lesen: UTF-8, sonst Windows-1252 (viele Bank-CSV-Exporte). */
async function readText(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

/** Zahlungsabgleich per Kontoauszug – ohne Zugriff aufs Bankkonto. */
export function BankImportButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      if (/\.zip$/i.test(f.name)) throw new Error("Bitte die ZIP-Datei zuerst entpacken und die XML-Datei(en) einzeln hochladen.");
      const text = await readText(f);
      const r = await fetch("/api/bills/bank-import", { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: text });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status}`);
      setRes(d); onDone();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => { setOpen(true); setRes(null); setErr(null); }}><Landmark className="h-4 w-4" />Zahlungen abgleichen</button>
      {open && (
        <div className="fixed inset-0 z-50 !m-0 grid place-items-center p-4">
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="glass relative w-full max-w-lg space-y-3 p-5 animate-fadein">
            <header className="flex items-center justify-between"><h3 className="font-semibold text-zinc-100">Zahlungen per Kontoauszug abgleichen</h3><button className="btn-ghost p-2" onClick={() => setOpen(false)} aria-label="Schließen"><X className="h-4 w-4" /></button></header>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-300">
              <li>Im Online-Banking die Umsätze des Geschäftskontos öffnen.</li>
              <li>Exportieren als <b>CAMT.053 (XML)</b> – oder als <b>CSV</b>, wenn Ihre Bank kein CAMT anbietet.</li>
              <li>Datei hier hochladen. Rechnungen mit passender Nummer und passendem Betrag werden automatisch als bezahlt markiert.</li>
            </ol>
            <p className="text-xs text-zinc-500">Wir brauchen keinen Zugang zu Ihrem Konto. Ausgaben und fremde Zahlungen werden nicht gespeichert, nur zugeordnete Zahlungseingänge (90 Tage).</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-600 p-5 text-sm text-zinc-300 hover:border-cyan-400/60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "Wird abgeglichen …" : "Kontoauszug wählen (.xml, .csv)"}
              <input type="file" accept=".xml,.csv,.txt,text/xml,application/xml,text/csv" className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </label>
            {err && <p className="text-sm text-amber-400">{err}</p>}
            {res && (
              <div className="space-y-1 rounded-lg bg-white/5 p-3 text-sm">
                <p className="text-zinc-300">{res.credits} Zahlungseingänge gelesen.</p>
                <p className="text-emerald-300">{res.matched.length} Rechnung{res.matched.length === 1 ? "" : "en"} automatisch als bezahlt markiert{res.matched.length ? `: ${res.matched.map((m) => m.number).join(", ")}` : ""}.</p>
                {res.suggested > 0 && <p className="text-amber-300">{res.suggested} Zahlung{res.suggested === 1 ? "" : "en"} bitte prüfen (siehe „Zahlungen prüfen“).</p>}
                <p className="text-xs text-zinc-500">{res.unmatched} ohne Bezug zu offenen Rechnungen{res.duplicates ? ` · ${res.duplicates} bereits verarbeitet` : ""}.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Vorschläge, die nicht eindeutig waren (Teilzahlung, Nummer fehlt, nur Betrag passt). */
export function BankSuggestions({ onChanged }: { onChanged: () => void }) {
  const { data, reload } = usePoll<{ suggestions: Suggestion[] }>("/api/bills/bank-import", 60_000);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data?.suggestions.length) return null;
  async function act(id: string, action: "accept" | "ignore") {
    setBusy(id);
    try { await apiFetch(`/api/bills/bank-import/${id}`, { method: "POST", json: { action } }); reload(); onChanged(); } finally { setBusy(null); }
  }
  return (
    <Panel title={<span className="flex items-center gap-1">Zahlungen prüfen<InfoTip title="Zahlungen prüfen" steps={["Diese Zahlungseingänge passen wahrscheinlich zu einer Rechnung, aber nicht eindeutig.", "Zuordnen markiert die Rechnung als bezahlt (mit dem Buchungsdatum).", "Bei Teilzahlungen: erst zuordnen, wenn der Rest bezahlt ist – oder ignorieren."]} /></span>}>
      <ul className="space-y-2">
        {data.suggestions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 p-3 text-sm">
            <div className="min-w-0">
              <div className="text-zinc-100"><span className="font-mono">{euro(s.amountCents)}</span> am {new Date(s.bookingDate).toLocaleDateString("de-DE")} von {s.counterparty || "unbekannt"}</div>
              <div className="truncate text-xs text-zinc-500">„{s.reference}“</div>
              <div className="text-xs text-amber-300">{s.reason}{s.bill ? ` → ${s.bill.number} (${euro(s.bill.grossCents)}, ${s.bill.customer.companyName || s.bill.customer.name || ""})` : ""}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => act(s.id, "ignore")}>Ignorieren</button>
              {s.bill?.status === "ISSUED" && <button className="btn-primary text-xs" disabled={!!busy} onClick={() => act(s.id, "accept")}>{busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Zuordnen</button>}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
