"use client";

import { Fragment, use, useEffect, useState } from "react";
import { Printer } from "lucide-react";

type Line = { description: string; quantity: number; unit: string; unitCents: number; taxRate: number; totalCents: number };
type Doc = {
  kind: "QUOTE" | "INVOICE" | "CREDIT_NOTE"; status: string; number: string; issueDate: string; serviceDate: string | null; dueAt: string | null;
  issuer: { name: string; address: string; taxNumber: string; vatId: string; iban: string; bic: string; bankName: string; email: string; phone: string; footer: string };
  recipient: { name: string; companyName: string | null; address: string };
  lines: Line[]; taxes: { rate: number; netCents: number; taxCents: number }[]; netCents: number; taxCents: number; grossCents: number;
  smallBusiness: boolean; introText: string | null; note: string | null; paidAt: string | null; qrSvg: string | null;
};
const TITLE = { QUOTE: "Angebot", INVOICE: "Rechnung", CREDIT_NOTE: "Gutschrift" };
const eur = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");
const qty = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 3 });

/** Beleg für den Endkunden: Ansicht, Druck/PDF, GiroCode zum Bezahlen. Kein Login, zufälliger Link. */
export default function PublicBill({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [d, setD] = useState<Doc | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/public/bills/${token}`).then(async (r) => (r.ok ? setD(await r.json()) : setErr(r.status === 404 ? "Dieser Beleg wurde nicht gefunden." : "Der Beleg kann gerade nicht geladen werden.")));
  }, [token]);
  if (err) return <p className="p-8 text-zinc-500">{err}</p>;
  if (!d) return <p className="p-8 text-zinc-400">Lade …</p>;
  const title = TITLE[d.kind];
  return (
    <div className="min-h-screen bg-white p-4 text-[#1f2530] print:p-0 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-3 print:hidden">
          {d.status === "PAID" && <span className="rounded-full bg-[#dcf3ee] px-3 py-1 text-xs font-semibold text-[#0f766e]">Bezahlt am {day(d.paidAt)}</span>}
          {d.status === "CANCELLED" && <span className="rounded-full bg-[#fde8e7] px-3 py-1 text-xs font-semibold text-[#b42318]">Storniert</span>}
          <button className="inline-flex items-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}><Printer className="h-4 w-4" />Drucken / als PDF speichern</button>
        </div>
        <article className="space-y-8 text-sm leading-relaxed" aria-label={`${title} ${d.number}`}>
          <header className="flex flex-wrap justify-between gap-6">
            <div>
              <div className="text-lg font-bold">{d.issuer.name}</div>
              <div className="whitespace-pre-line text-xs text-[#6b7484]">{d.issuer.address}{d.issuer.phone ? `\nTel. ${d.issuer.phone}` : ""}{d.issuer.email ? `\n${d.issuer.email}` : ""}</div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold">{title}</h1>
              <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-4 text-xs">
                <dt className="text-[#6b7484]">Nummer</dt><dd className="font-semibold">{d.number}</dd>
                <dt className="text-[#6b7484]">Datum</dt><dd>{day(d.issueDate)}</dd>
                {d.kind !== "QUOTE" && d.serviceDate && <><dt className="text-[#6b7484]">Leistungsdatum</dt><dd>{day(d.serviceDate)}</dd></>}
                {d.dueAt && d.kind !== "CREDIT_NOTE" && <><dt className="text-[#6b7484]">{d.kind === "QUOTE" ? "Gültig bis" : "Fällig am"}</dt><dd>{day(d.dueAt)}</dd></>}
              </dl>
            </div>
          </header>
          <section className="whitespace-pre-line">
            <div className="text-xs text-[#6b7484]">{d.issuer.name} · {d.issuer.address.split("\n").join(", ")}</div>
            <div className="mt-1 font-semibold">{d.recipient.companyName || d.recipient.name}</div>
            {d.recipient.companyName && <div>{d.recipient.name}</div>}
            <div>{d.recipient.address}</div>
          </section>
          {d.introText && <p>{d.introText}</p>}
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-[#d0d5dc] text-left text-xs text-[#6b7484]"><th className="py-2">Leistung</th><th className="py-2 text-right">Menge</th><th className="py-2 text-right">Einzelpreis</th>{!d.smallBusiness && <th className="py-2 text-right">USt.</th>}<th className="py-2 text-right">Betrag</th></tr></thead>
            <tbody>
              {d.lines.map((l, i) => (
                <tr key={i} className="border-b border-[#eef0f3]"><td className="py-2">{l.description}</td><td className="py-2 text-right tabular-nums">{qty(l.quantity)} {l.unit}</td><td className="py-2 text-right tabular-nums">{eur(l.unitCents)}</td>{!d.smallBusiness && <td className="py-2 text-right tabular-nums">{l.taxRate} %</td>}<td className="py-2 text-right tabular-nums">{eur(l.totalCents)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-right">
            <dt>Summe netto</dt><dd className="tabular-nums">{eur(d.netCents)}</dd>
            {!d.smallBusiness && d.taxes.map((t) => <Fragment key={t.rate}><dt>Umsatzsteuer {t.rate} % auf {eur(t.netCents)}</dt><dd className="tabular-nums">{eur(t.taxCents)}</dd></Fragment>)}
            <dt className="border-t border-[#1f2530] pt-1 font-bold">Gesamt</dt><dd className="border-t border-[#1f2530] pt-1 font-bold tabular-nums">{eur(d.grossCents)}</dd>
          </dl>
          {d.smallBusiness && <p className="text-xs text-[#6b7484]">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>}
          {d.note && <p className="whitespace-pre-line text-xs text-[#6b7484]">{d.note}</p>}
          {d.kind === "INVOICE" && d.status === "ISSUED" && (
            <section className="flex flex-wrap items-center gap-6 rounded-xl border border-[#d0d5dc] p-4">
              {d.qrSvg && <div className="h-36 w-36 shrink-0" aria-label="GiroCode zum Bezahlen" dangerouslySetInnerHTML={{ __html: d.qrSvg }} />}
              <div className="text-xs leading-relaxed">
                <div className="font-semibold">Bitte überweisen Sie {eur(d.grossCents)} bis {day(d.dueAt)}.</div>
                <div>IBAN {d.issuer.iban.replace(/(.{4})/g, "$1 ").trim()}{d.issuer.bic ? ` · BIC ${d.issuer.bic}` : ""}{d.issuer.bankName ? ` · ${d.issuer.bankName}` : ""}</div>
                <div>Verwendungszweck: Rechnung {d.number}</div>
                {d.qrSvg && <div className="mt-1 text-[#6b7484]">Mit der Banking-App scannen – die Überweisung ist dann ausgefüllt.</div>}
              </div>
            </section>
          )}
          <footer className="border-t border-[#d0d5dc] pt-3 text-[11px] text-[#6b7484]">
            {d.issuer.name} · {d.issuer.taxNumber ? `Steuernummer ${d.issuer.taxNumber}` : ""}{d.issuer.taxNumber && d.issuer.vatId ? " · " : ""}{d.issuer.vatId ? `USt-IdNr. ${d.issuer.vatId}` : ""}
            {d.issuer.footer && <div className="mt-1 whitespace-pre-line">{d.issuer.footer}</div>}
          </footer>
        </article>
      </div>
    </div>
  );
}
