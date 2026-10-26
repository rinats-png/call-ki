import crypto from "node:crypto";
import { prisma } from "../db";
import { HttpError } from "../http";
import { markPaid } from "./bills";

/**
 * Zahlungsabgleich ohne Bankzugriff: Der Betrieb lädt einen Kontoauszug aus seinem Online-Banking hoch
 * (CAMT.053/.052/.054 als XML oder CSV). Nur Gutschriften werden betrachtet; gespeichert werden nur
 * zugeordnete bzw. vorgeschlagene Zahlungen (90 Tage), alle anderen Umsätze werden verworfen.
 */
export type Credit = { date: Date; amountCents: number; counterparty: string; reference: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").trim();
const tag = (xml: string, name: string) => { const m = new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml); return m ? m[1] : null; };
const tags = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "g"))].map((m) => m[1]);
const cents = (s: string) => Math.round(Number(s.trim()) * 100);

/** ISO-20022 CAMT (053 Tagesauszug, 052 untertägig, 054 Einzelbuchungen) – nur Gutschriften (CRDT). */
export function parseCamt(xml: string): Credit[] {
  if (!/<(\w+:)?(BkToCstmrStmt|BkToCstmrAcctRpt|BkToCstmrDbtCdtNtfctn)\b/.test(xml)) throw new HttpError(400, "Keine CAMT-Datei (erwartet: Kontoauszug im Format CAMT.053, .052 oder .054).");
  const out: Credit[] = [];
  for (const e of tags(xml, "Ntry")) {
    const ind = tag(e, "CdtDbtInd")?.trim();
    if (ind !== "CRDT" || /<(\w+:)?RvslInd>\s*true/.test(e)) continue;
    const rawDate = tag(tag(e, "BookgDt") ?? "", "Dt") ?? tag(tag(e, "BookgDt") ?? "", "DtTm") ?? tag(tag(e, "ValDt") ?? "", "Dt");
    const date = rawDate ? new Date(`${decode(rawDate).slice(0, 10)}T12:00:00Z`) : new Date();
    const txs = tags(e, "TxDtls");
    const parts = txs.length > 1 && txs.every((t) => tag(t, "Amt")) ? txs : [txs[0] ?? e];
    for (const t of parts) {
      const amt = tag(t, "Amt") ?? tag(e, "Amt");
      if (!amt) continue;
      const debtor = tag(t, "Dbtr") ?? "";
      const name = decode(tag(debtor, "Nm") ?? "");
      const ref = [...tags(t, "Ustrd").map(decode), decode(tag(t, "Ref") ?? ""), decode(tag(e, "AddtlNtryInf") ?? "")].filter(Boolean).join(" ");
      out.push({ date, amountCents: cents(decode(amt)), counterparty: name.slice(0, 140), reference: ref.slice(0, 500) });
    }
  }
  return out.filter((c) => c.amountCents > 0);
}

/** Deutsche Zahl „1.234,56“ / „-12,00“ / „1234.56“ → Cent */
export function parseGermanAmount(s: string): number | null {
  let v = s.replace(/[€\s]|EUR/gi, "").trim();
  if (!v) return null;
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(t);
  if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]), 12)); }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return null;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");
const COLS = {
  date: ["buchungstag", "buchungsdatum", "datum", "buchung", "wertstellung", "valuta", "valutadatum", "bookingdate"],
  amount: ["betrag", "betrageur", "umsatz", "umsatzeur", "betragineur", "amount", "betragin"],
  credit: ["haben", "eingang", "gutschrift"],
  ref: ["verwendungszweck", "vorgangverwendungszweck", "buchungstext", "beschreibung", "zahlungsreferenz", "purpose", "verwendungszweckzeile"],
  name: ["beguenstigterzahlungspflichtiger", "zahlungspflichtigerbeguenstigter", "auftraggeberempfaenger", "empfaengerauftraggeber", "auftraggeber", "zahlungspflichtiger", "zahlungspflichtigeer", "name", "gegenkontoname", "namezahlungsbeteiligter", "beguenstigterauftraggeber", "zahlungsbeteiligter", "counterparty"],
};
const findCol = (h: string[], keys: string[]) => { for (const k of keys) { const i = h.findIndex((x) => x === k); if (i >= 0) return i; } for (const k of keys) { const i = h.findIndex((x) => x.startsWith(k)); if (i >= 0) return i; } return -1; };

/** CSV-Export deutscher Banken (Sparkasse, Volksbank, DKB, ING, Commerzbank, …): Kopfzeile wird gesucht. */
export function parseBankCsv(text: string): Credit[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const sep = [";", "\t", ","].sort((a, b) => lines[i].split(b).length - lines[i].split(a).length)[0];
    const head = splitCsvLine(lines[i], sep).map(norm);
    const iDate = findCol(head, COLS.date);
    const iAmt = findCol(head, COLS.amount);
    const iCredit = findCol(head, COLS.credit);
    if (iDate < 0 || (iAmt < 0 && iCredit < 0)) continue;
    const iRef = findCol(head, COLS.ref);
    const iName = findCol(head, COLS.name);
    const out: Credit[] = [];
    for (const l of lines.slice(i + 1)) {
      const c = splitCsvLine(l, sep);
      const date = parseDate(c[iDate] ?? "");
      const amount = parseGermanAmount((iAmt >= 0 ? c[iAmt] : c[iCredit]) ?? "");
      if (!date || amount === null || amount <= 0) continue;
      // einige Banken trennen Soll/Haben in einer Extra-Spalte („S“/„H“)
      const sh = c.find((x) => x === "S" || x === "H");
      if (sh === "S") continue;
      out.push({ date, amountCents: amount, counterparty: (iName >= 0 ? c[iName] : "").slice(0, 140), reference: (iRef >= 0 ? c[iRef] : c.filter((_, k) => k !== iDate && k !== iAmt).join(" ")).slice(0, 500) });
    }
    return out;
  }
  throw new HttpError(400, "CSV nicht erkannt: Es fehlen Spalten für Datum und Betrag. Bitte als CAMT (XML) exportieren oder eine CSV mit Kopfzeile verwenden.");
}

export function parseStatement(text: string): Credit[] {
  return text.trimStart().startsWith("<") ? parseCamt(text) : parseBankCsv(text);
}

const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Steht die Rechnungsnummer im Verwendungszweck? Tolerant gegen Leer- und Bindestriche, nicht als Teil einer längeren Zahl. */
export function referenceHasNumber(reference: string, number: string): boolean {
  const ref = alnum(reference), n = alnum(number);
  let i = ref.indexOf(n);
  while (i >= 0) {
    if (!/\d/.test(ref[i + n.length] ?? "")) return true;
    i = ref.indexOf(n, i + 1);
  }
  return false;
}

const nameMatch = (a: string, b: string) => {
  const ta = new Set(a.toLowerCase().split(/[^a-zäöüß]+/).filter((x) => x.length >= 3));
  return b.toLowerCase().split(/[^a-zäöüß]+/).some((x) => x.length >= 3 && ta.has(x));
};

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
type OpenBill = { id: string; number: string | null; grossCents: number; customer: { name: string | null; companyName: string | null } };
export type MatchResult = { status: "MATCHED" | "SUGGESTED" | "UNMATCHED"; billId: string | null; reason: string };

/** Zuordnung: Nummer + exakter Betrag → automatisch; Nummer mit anderem Betrag oder eindeutiger Betrag/Name → Vorschlag. */
export function matchCredit(c: Credit, open: OpenBill[]): MatchResult {
  const byNumber = open.filter((b) => b.number && referenceHasNumber(c.reference, b.number));
  if (byNumber.length === 1) {
    const b = byNumber[0];
    if (b.grossCents === c.amountCents) return { status: "MATCHED", billId: b.id, reason: `Rechnungsnummer ${b.number} und Betrag stimmen` };
    return { status: "SUGGESTED", billId: b.id, reason: c.amountCents < b.grossCents ? `Rechnungsnummer ${b.number}, aber nur ${eur(c.amountCents)} statt ${eur(b.grossCents)} (Teilzahlung?)` : `Rechnungsnummer ${b.number}, aber abweichender Betrag` };
  }
  if (byNumber.length > 1) {
    const exact = byNumber.filter((b) => b.grossCents === c.amountCents);
    if (exact.length === 1) return { status: "SUGGESTED", billId: exact[0].id, reason: "mehrere Rechnungsnummern im Verwendungszweck, Betrag passt zu einer" };
    return { status: "UNMATCHED", billId: null, reason: "mehrere Rechnungen im Verwendungszweck (Sammelzahlung)" };
  }
  const byAmount = open.filter((b) => b.grossCents === c.amountCents);
  const withName = byAmount.filter((b) => nameMatch(c.counterparty, `${b.customer.name ?? ""} ${b.customer.companyName ?? ""}`));
  if (withName.length === 1) return { status: "SUGGESTED", billId: withName[0].id, reason: "Betrag und Name passen, Rechnungsnummer fehlt im Verwendungszweck" };
  if (byAmount.length === 1) return { status: "SUGGESTED", billId: byAmount[0].id, reason: "nur der Betrag passt – bitte prüfen" };
  return { status: "UNMATCHED", billId: null, reason: "" };
}

const hashOf = (c: Credit) => crypto.createHash("sha256").update(`${c.date.toISOString().slice(0, 10)}|${c.amountCents}|${c.reference}|${c.counterparty}`).digest("hex");

/** Kontoauszug verarbeiten: eindeutige Zahlungen als bezahlt markieren, Vorschläge zur Prüfung ablegen. */
export async function importStatement(tenantId: string, text: string) {
  const credits = parseStatement(text);
  const open = await prisma.bill.findMany({ where: { tenantId, kind: "INVOICE", status: "ISSUED" }, select: { id: true, number: true, grossCents: true, customer: { select: { name: true, companyName: true } } } });
  const result = { credits: credits.length, matched: [] as { number: string | null; amountCents: number }[], suggested: 0, unmatched: 0, duplicates: 0 };
  for (const c of credits) {
    const hash = hashOf(c);
    if (await prisma.bankTransaction.findUnique({ where: { tenantId_hash: { tenantId, hash } } })) { result.duplicates++; continue; }
    const m = matchCredit(c, open);
    if (m.status === "UNMATCHED") { result.unmatched++; continue; }
    await prisma.bankTransaction.create({ data: { tenantId, hash, bookingDate: c.date, amountCents: c.amountCents, counterparty: c.counterparty, reference: c.reference, status: m.status, billId: m.billId, reason: m.reason } });
    if (m.status === "MATCHED") {
      await markPaid(tenantId, m.billId!, "Überweisung (Kontoauszug)", c.date);
      const i = open.findIndex((b) => b.id === m.billId);
      result.matched.push({ number: open[i].number, amountCents: c.amountCents });
      open.splice(i, 1); // nicht zweimal zuordnen
    } else result.suggested++;
  }
  return result;
}

/** Vorschlag annehmen (Rechnung bezahlt) oder verwerfen. */
export async function resolveSuggestion(tenantId: string, id: string, action: "accept" | "ignore") {
  const t = await prisma.bankTransaction.findFirst({ where: { id, tenantId, status: "SUGGESTED" } });
  if (!t) throw new HttpError(404, "Vorschlag nicht gefunden.");
  if (action === "accept" && t.billId) await markPaid(tenantId, t.billId, "Überweisung (Kontoauszug)", t.bookingDate);
  await prisma.bankTransaction.update({ where: { id }, data: { status: action === "accept" ? "ACCEPTED" : "IGNORED" } });
}

/** Löschjob: Zahlungsdaten aus Kontoauszügen nach 90 Tagen entfernen. */
export async function purgeBankTransactions(now = new Date()) {
  return (await prisma.bankTransaction.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 86400_000) } } })).count;
}
