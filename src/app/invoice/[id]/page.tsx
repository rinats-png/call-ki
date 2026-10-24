"use client";

import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";

type Line = { label: string; quantity: number; unit: string; unitCents: number; totalCents: number };
type Inv = {
  number: string; year: number; month: number; issuedAt: string; dueAt: string; partial: boolean;
  issuer: { name: string; address: string; taxId: string; iban: string; email: string };
  recipient: { name: string; address: string; vatId: string };
  lines: Line[]; netCents: number; vatPercent: number; vatCents: number; grossCents: number;
};

const eur = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const day = (s: string) => new Date(s).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });

/** Druckansicht einer Rechnung („Drucken → Als PDF speichern“). Inhalt ist eingefroren. */
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<Inv | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/invoices/${id}`).then(async (r) => (r.ok ? setInv(await r.json()) : setErr(r.status === 404 ? "Rechnung nicht gefunden." : `Fehler ${r.status}`)));
  }, [id]);
  if (err) return <p className="p-8 text-zinc-300">{err}</p>;
  if (!inv) return <p className="p-8 text-zinc-400">Lade …</p>;
  const period = new Date(Date.UTC(inv.year, inv.month - 1, 15)).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  return (
    <div className="min-h-screen bg-white p-4 text-[#1f2530] print:p-0 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-end print:hidden">
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}><Printer className="h-4 w-4" />Drucken / als PDF speichern</button>
        </div>
        <article className="space-y-8 text-sm leading-relaxed" aria-label={`Rechnung ${inv.number}`}>
          <header className="flex flex-wrap justify-between gap-6">
            <div className="whitespace-pre-line text-xs text-[#6b7484]">{inv.issuer.name}{"\n"}{inv.issuer.address}</div>
            <div className="text-right">
              <h1 className="text-2xl font-bold">Rechnung</h1>
              <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 text-xs">
                <dt className="text-[#6b7484]">Nummer</dt><dd className="font-semibold">{inv.number}</dd>
                <dt className="text-[#6b7484]">Datum</dt><dd>{day(inv.issuedAt)}</dd>
                <dt className="text-[#6b7484]">Leistungszeitraum</dt><dd>{period}{inv.partial ? " (bis Vertragsende)" : ""}</dd>
              </dl>
            </div>
          </header>
          <section className="whitespace-pre-line">
            <div className="font-semibold">{inv.recipient.name}</div>
            {inv.recipient.address || <span className="text-[#b45309]">Rechnungsanschrift fehlt</span>}
            {inv.recipient.vatId && <div className="text-xs text-[#6b7484]">USt-IdNr. {inv.recipient.vatId}</div>}
          </section>
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-[#d0d5dc] text-left text-xs text-[#6b7484]"><th className="py-2">Leistung</th><th className="py-2 text-right">Menge</th><th className="py-2 text-right">Einzelpreis</th><th className="py-2 text-right">Betrag</th></tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className="border-b border-[#eef0f3]"><td className="py-2">{l.label}</td><td className="py-2 text-right tabular-nums">{l.quantity} {l.unit}</td><td className="py-2 text-right tabular-nums">{eur(l.unitCents)}</td><td className="py-2 text-right tabular-nums">{eur(l.totalCents)}</td></tr>
              ))}
            </tbody>
            <tfoot className="text-right">
              <tr><td colSpan={3} className="pt-3">Summe netto</td><td className="pt-3 tabular-nums">{eur(inv.netCents)}</td></tr>
              <tr><td colSpan={3}>Umsatzsteuer {inv.vatPercent} %</td><td className="tabular-nums">{eur(inv.vatCents)}</td></tr>
              <tr className="text-base font-bold"><td colSpan={3} className="pt-1">Gesamtbetrag</td><td className="pt-1 tabular-nums">{eur(inv.grossCents)}</td></tr>
            </tfoot>
          </table>
          <p>Bitte überweisen Sie den Gesamtbetrag bis zum <b>{day(inv.dueAt)}</b>{inv.issuer.iban ? <> auf das Konto <b>{inv.issuer.iban}</b></> : null} unter Angabe der Rechnungsnummer {inv.number}.</p>
          <footer className="border-t border-[#d0d5dc] pt-3 text-xs text-[#6b7484]">
            {inv.issuer.name} · {inv.issuer.address.replace(/\n/g, ", ")} · Steuernummer/USt-IdNr. {inv.issuer.taxId}{inv.issuer.email ? ` · ${inv.issuer.email}` : ""}
          </footer>
        </article>
      </div>
    </div>
  );
}
