import crypto from "node:crypto";
import type { Bill, Customer, Prisma, Tenant } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { HttpError } from "../http";
import { emailLayout, sendEmail } from "../notify";
import { hasModule } from "../addons";
import { parseSettings } from "../tenant/settings";
import { xmlEscape as h } from "../twiml";

/**
 * Belege an Endkunden (Angebot, Rechnung, Gutschrift) – übernommen aus dem Veyra-Prototyp, hier
 * mandantenfähig, serverseitig gerechnet und GoBD-konform: Ausgestellte Belege werden nie geändert,
 * eine Rechnung wird nur durch eine Gutschrift (Storno) aufgehoben.
 * Pflichtangaben § 14 UStG, Steuerfälle über 0/7/19 % und § 19 UStG hinaus [PRÜFEN].
 */
export const BILL_KINDS = ["QUOTE", "INVOICE", "CREDIT_NOTE"] as const;
export type BillKind = (typeof BILL_KINDS)[number];
export const PREFIX: Record<BillKind, string> = { QUOTE: "AN", INVOICE: "RE", CREDIT_NOTE: "GS" };
export const KIND_LABEL: Record<BillKind, string> = { QUOTE: "Angebot", INVOICE: "Rechnung", CREDIT_NOTE: "Gutschrift" };

export type BillLine = { description: string; quantity: number; unit: string; unitCents: number; taxRate: number; serviceId?: string | null; totalCents?: number };
export type TaxRow = { rate: number; netCents: number; taxCents: number };
export type Issuer = { name: string; address: string; taxNumber: string; vatId: string; iban: string; bic: string; bankName: string; email: string; phone: string; footer: string };
export type Recipient = { name: string; companyName: string | null; address: string; email: string | null };

/** Positionen prüfen und Summen je Steuersatz berechnen (kaufmännisch gerundet je Position und Steuersatz). */
export function calcBill(rawLines: BillLine[], smallBusiness: boolean) {
  const lines = rawLines.map((l) => {
    const quantity = Math.round(Number(l.quantity) * 1000) / 1000;
    const unitCents = Math.round(Number(l.unitCents));
    const taxRate = smallBusiness ? 0 : Number(l.taxRate);
    if (!l.description?.trim()) throw new HttpError(400, "Jede Position braucht eine Beschreibung.");
    if (!Number.isFinite(quantity) || quantity === 0 || Math.abs(quantity) > 100000) throw new HttpError(400, "Menge ungültig.");
    if (!Number.isFinite(unitCents) || Math.abs(unitCents) > 10_000_000_00) throw new HttpError(400, "Preis ungültig.");
    if (![0, 7, 19].includes(taxRate)) throw new HttpError(400, "Steuersatz nur 0, 7 oder 19 %.");
    return { description: l.description.trim().slice(0, 300), quantity, unit: (l.unit || "Stück").slice(0, 20), unitCents, taxRate, serviceId: l.serviceId ?? null, totalCents: Math.round(quantity * unitCents) };
  });
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + l.totalCents);
  const taxes: TaxRow[] = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, netCents]) => ({ rate, netCents, taxCents: Math.round((netCents * rate) / 100) }));
  const netCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const taxCents = taxes.reduce((s, t) => s + t.taxCents, 0);
  return { lines, taxes, netCents, taxCents, grossCents: netCents + taxCents };
}

export function issuerFor(tenant: Pick<Tenant, "name" | "settings">): { issuer: Issuer; smallBusiness: boolean; paymentDays: number; missing: string[] } {
  const inv = parseSettings(tenant.settings).invoicing;
  const issuer: Issuer = { name: inv.legalName || tenant.name, address: inv.address, taxNumber: inv.taxNumber, vatId: inv.vatId, iban: inv.iban.replace(/\s+/g, "").toUpperCase(), bic: inv.bic.toUpperCase(), bankName: inv.bankName, email: inv.email, phone: inv.phone, footer: inv.footer };
  const missing: string[] = [];
  if (!issuer.address) missing.push("Anschrift");
  if (!issuer.taxNumber && !issuer.vatId) missing.push("Steuernummer oder USt-IdNr.");
  return { issuer, smallBusiness: inv.smallBusiness, paymentDays: inv.paymentDays, missing };
}

export function recipientOf(c: Pick<Customer, "name" | "companyName" | "address" | "postalCode" | "email" | "phone">): Recipient {
  return { name: c.name || c.companyName || c.phone, companyName: c.companyName, address: [c.address, c.postalCode && !(c.address ?? "").includes(c.postalCode) ? c.postalCode : null].filter(Boolean).join(", "), email: c.email };
}

/** IBAN-Prüfziffer (ISO 13616) */
export function validIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of r) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}

/** EPC-QR („GiroCode“, Version 002): jede Banking-App füllt damit die Überweisung aus. */
export function girocodePayload(o: { name: string; iban: string; bic?: string; amountCents: number; reference: string }): string | null {
  if (!validIban(o.iban) || o.amountCents <= 0 || o.amountCents > 999_999_999_99) return null;
  const amount = `EUR${(o.amountCents / 100).toFixed(2)}`;
  return ["BCD", "002", "1", "SCT", (o.bic ?? "").trim(), o.name.slice(0, 70), o.iban.replace(/\s+/g, ""), amount, "", "", o.reference.slice(0, 140), ""].join("\n").trimEnd();
}

export const newToken = () => crypto.randomBytes(24).toString("base64url");

export async function nextBillNumber(tenantId: string, kind: BillKind, year: number, tx: Prisma.TransactionClient = prisma): Promise<string> {
  const c = await tx.billCounter.upsert({ where: { tenantId_year_kind: { tenantId, year, kind } }, create: { tenantId, year, kind, last: 1 }, update: { last: { increment: 1 } } });
  return `${PREFIX[kind]}-${year}-${String(c.last).padStart(4, "0")}`;
}

export function publicUrl(b: Pick<Bill, "publicToken">) {
  return `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/b/${b.publicToken}`;
}

type DraftInput = { kind: BillKind; customerId: string; ticketId?: string | null; lines: BillLine[]; serviceDate?: Date | null; introText?: string | null; note?: string | null; createdById?: string | null };

export async function createDraft(tenantId: string, d: DraftInput) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!(await prisma.customer.count({ where: { id: d.customerId, tenantId } }))) throw new HttpError(404, "Kunde nicht gefunden.");
  if (d.ticketId && !(await prisma.callTicket.count({ where: { id: d.ticketId, tenantId } }))) throw new HttpError(404, "Vorgang nicht gefunden.");
  if (d.kind === "CREDIT_NOTE") throw new HttpError(400, "Gutschriften entstehen nur durch Storno einer Rechnung.");
  const { smallBusiness } = issuerFor(tenant);
  const c = calcBill(d.lines, smallBusiness);
  return prisma.bill.create({
    data: { tenantId, kind: d.kind, customerId: d.customerId, ticketId: d.ticketId ?? null, serviceDate: d.serviceDate ?? null, introText: d.introText ?? null, note: d.note ?? null, createdById: d.createdById ?? null, smallBusiness, lines: c.lines, taxes: c.taxes, netCents: c.netCents, taxCents: c.taxCents, grossCents: c.grossCents, publicToken: newToken() },
  });
}

export async function updateDraft(tenantId: string, id: string, d: Partial<Omit<DraftInput, "kind">>) {
  const b = await prisma.bill.findFirst({ where: { id, tenantId }, include: { tenant: true } });
  if (!b) throw new HttpError(404, "Beleg nicht gefunden.");
  if (b.status !== "DRAFT") throw new HttpError(409, "Ausgestellte Belege können nicht mehr geändert werden – stornieren und neu ausstellen.");
  if (d.customerId && !(await prisma.customer.count({ where: { id: d.customerId, tenantId } }))) throw new HttpError(404, "Kunde nicht gefunden.");
  const { smallBusiness } = issuerFor(b.tenant);
  const c = d.lines ? calcBill(d.lines, smallBusiness) : null;
  return prisma.bill.update({
    where: { id },
    data: {
      ...(d.customerId ? { customerId: d.customerId } : {}),
      ...(d.serviceDate !== undefined ? { serviceDate: d.serviceDate } : {}),
      ...(d.introText !== undefined ? { introText: d.introText } : {}),
      ...(d.note !== undefined ? { note: d.note } : {}),
      ...(c ? { smallBusiness, lines: c.lines, taxes: c.taxes, netCents: c.netCents, taxCents: c.taxCents, grossCents: c.grossCents } : {}),
    },
  });
}

/** Ausstellen: Nummer vergeben, Aussteller/Empfänger/Positionen einfrieren. */
export async function issueBill(tenantId: string, id: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.bill.findFirst({ where: { id, tenantId }, include: { tenant: true, customer: true } });
    if (!b) throw new HttpError(404, "Beleg nicht gefunden.");
    if (b.status !== "DRAFT") throw new HttpError(409, "Beleg ist bereits ausgestellt.");
    const { issuer, smallBusiness, paymentDays, missing } = issuerFor(b.tenant);
    if (b.kind !== "QUOTE" && missing.length) throw new HttpError(400, `Für Rechnungen fehlen Angaben unter Einstellungen → Rechnungen: ${missing.join(", ")}.`);
    const lines = b.lines as unknown as BillLine[];
    if (!lines.length) throw new HttpError(400, "Der Beleg hat keine Positionen.");
    const c = calcBill(lines, smallBusiness);
    const recipient = recipientOf(b.customer);
    if (b.kind !== "QUOTE" && !recipient.address) throw new HttpError(400, "Beim Kunden fehlt die Anschrift.");
    const number = await nextBillNumber(tenantId, b.kind as BillKind, now.getUTCFullYear(), tx);
    const days = b.kind === "QUOTE" ? 30 : paymentDays;
    return tx.bill.update({
      where: { id },
      data: { status: "ISSUED", number, issueDate: now, serviceDate: b.serviceDate ?? now, dueAt: new Date(now.getTime() + days * 86400_000), issuer, recipient, smallBusiness, lines: c.lines, taxes: c.taxes, netCents: c.netCents, taxCents: c.taxCents, grossCents: c.grossCents },
    });
  });
}

export async function markPaid(tenantId: string, id: string, method: string, at = new Date()) {
  const r = await prisma.bill.updateMany({ where: { id, tenantId, kind: "INVOICE", status: "ISSUED" }, data: { status: "PAID", paidAt: at, paymentMethod: method.slice(0, 40) } });
  if (!r.count) throw new HttpError(409, "Nur offene Rechnungen können als bezahlt markiert werden.");
}

/** Storno: Gutschrift mit negativen Positionen, verweist auf die Rechnung; Rechnung → CANCELLED. */
export async function cancelInvoice(tenantId: string, id: string, reason: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const b = await tx.bill.findFirst({ where: { id, tenantId } });
    if (!b || b.kind !== "INVOICE") throw new HttpError(404, "Rechnung nicht gefunden.");
    if (b.status === "DRAFT") throw new HttpError(409, "Entwürfe werden gelöscht, nicht storniert.");
    if (b.status === "CANCELLED") throw new HttpError(409, "Rechnung ist bereits storniert.");
    const lines = (b.lines as unknown as BillLine[]).map((l) => ({ ...l, quantity: -l.quantity }));
    const c = calcBill(lines, b.smallBusiness);
    const number = await nextBillNumber(tenantId, "CREDIT_NOTE", now.getUTCFullYear(), tx);
    const credit = await tx.bill.create({
      data: { tenantId, kind: "CREDIT_NOTE", status: "ISSUED", number, customerId: b.customerId, ticketId: b.ticketId, relatedId: b.id, issueDate: now, serviceDate: b.serviceDate, issuer: b.issuer ?? undefined, recipient: b.recipient ?? undefined, smallBusiness: b.smallBusiness, lines: c.lines, taxes: c.taxes, netCents: c.netCents, taxCents: c.taxCents, grossCents: c.grossCents, introText: `Storno der Rechnung ${b.number}${reason ? ` – ${reason.slice(0, 200)}` : ""}`, publicToken: newToken() },
    });
    await tx.bill.update({ where: { id: b.id }, data: { status: "CANCELLED", note: [b.note, `Storniert durch ${number}`].filter(Boolean).join("\n") } });
    return credit;
  });
}

/** Angebot annehmen → Rechnungsentwurf mit denselben Positionen. */
export async function convertQuote(tenantId: string, id: string) {
  const q = await prisma.bill.findFirst({ where: { id, tenantId, kind: "QUOTE" } });
  if (!q) throw new HttpError(404, "Angebot nicht gefunden.");
  if (q.status === "DRAFT") throw new HttpError(409, "Angebot erst ausstellen.");
  const draft = await createDraft(tenantId, { kind: "INVOICE", customerId: q.customerId, ticketId: q.ticketId, lines: q.lines as unknown as BillLine[], introText: `Gemäß Angebot ${q.number}` });
  await prisma.$transaction([
    prisma.bill.update({ where: { id: draft.id }, data: { relatedId: q.id } }),
    prisma.bill.update({ where: { id: q.id }, data: { status: "ACCEPTED" } }),
  ]);
  return draft;
}

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const day = (d: Date | null) => (d ? d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");

/** Beleg per E-Mail mit Link senden (oder Zahlungserinnerung/Mahnung bei level ≥ 1). */
export async function sendBill(tenantId: string, id: string, opts: { to?: string; level?: number } = {}) {
  const b = await prisma.bill.findFirst({ where: { id, tenantId }, include: { customer: true, tenant: true } });
  if (!b) throw new HttpError(404, "Beleg nicht gefunden.");
  if (b.status === "DRAFT") throw new HttpError(409, "Erst ausstellen, dann senden.");
  const to = (opts.to || b.customer.email || "").trim();
  if (!to) throw new HttpError(400, "Beim Kunden ist keine E-Mail-Adresse hinterlegt.");
  const issuer = b.issuer as unknown as Issuer;
  const kind = KIND_LABEL[b.kind as BillKind];
  const link = publicUrl(b);
  const level = opts.level ?? 0;
  const greet = b.customer.name ? `Guten Tag ${h(b.customer.name)},` : "Guten Tag,";
  let subject = `${kind} ${b.number} von ${issuer.name}`;
  let body = `<p>${greet}</p><p>anbei ${b.kind === "QUOTE" ? "unser Angebot" : b.kind === "INVOICE" ? "unsere Rechnung" : "unsere Gutschrift"} <b>${h(b.number ?? "")}</b> über <b>${eur(b.grossCents)}</b>.</p>`;
  if (b.kind === "INVOICE") body += `<p>Zahlbar bis ${day(b.dueAt)}. Über den Link finden Sie die Rechnung zum Drucken und einen QR-Code für Ihre Banking-App.</p>`;
  if (level >= 1) {
    subject = `${level === 1 ? "Zahlungserinnerung" : "Mahnung"}: Rechnung ${b.number}`;
    body = `<p>${greet}</p><p>${level === 1 ? "sicher ist es Ihnen entgangen:" : "trotz unserer Erinnerung ist"} die Rechnung <b>${h(b.number ?? "")}</b> über <b>${eur(b.grossCents)}</b> vom ${day(b.issueDate)} ${level === 1 ? "ist seit dem" : "seit dem"} ${day(b.dueAt)} fällig${level === 1 ? "" : " und noch offen"}. Bitte überweisen Sie den Betrag in den nächsten 7 Tagen.</p><p>Haben Sie bereits gezahlt? Dann betrachten Sie diese Nachricht bitte als gegenstandslos.</p>`;
  }
  body += `<p><a href="${h(link)}">${h(kind)} ansehen</a></p><p>Mit freundlichen Grüßen<br/>${h(issuer.name)}</p>`;
  const r = await sendEmail({ tenantId, to, subject, html: emailLayout(body, h(issuer.name)), purpose: level ? "PAYMENT_REMINDER" : "BILL", fromName: issuer.name, replyTo: issuer.email || undefined });
  await prisma.bill.update({ where: { id }, data: level ? { reminderLevel: level, lastReminderAt: new Date() } : { sentAt: new Date() } });
  return r;
}

/** Cron: automatische Zahlungserinnerung (Stufe 1) und Mahnung (Stufe 2) je Betrieb, falls eingeschaltet. */
export async function runBillReminders(now = new Date()) {
  const overdue = await prisma.bill.findMany({ where: { kind: "INVOICE", status: "ISSUED", dueAt: { lt: now }, reminderLevel: { lt: 2 } }, include: { tenant: true, customer: true }, take: 300 });
  let sent = 0;
  for (const b of overdue) {
    const inv = parseSettings(b.tenant.settings).invoicing;
    if (!inv.autoReminders || !b.customer.email || !(await hasModule(b.tenantId, "invoicing", now))) continue;
    const level = b.reminderLevel + 1;
    const afterDays = inv.reminderDays[level - 1];
    if (afterDays == null || now.getTime() < b.dueAt!.getTime() + afterDays * 86400_000) continue;
    try {
      await sendBill(b.tenantId, b.id, { level });
      sent++;
    } catch (e) {
      logger.warn("bill.reminder_failed", { tenantId: b.tenantId, billId: b.id, error: (e as Error).message });
    }
  }
  return { checked: overdue.length, sent };
}
