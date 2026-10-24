import type { BillingSnapshot } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { setting, settingNumber } from "../platform/config";
import { emailLayout, sendEmail } from "../notify";
import { xmlEscape as h } from "../twiml";
import type { Invoice as InvoicePreview } from "../billing";

/**
 * Rechnungen aus dem Monatsabschluss: fortlaufende Nummer je Jahr (JJJJ-NNNN), Inhalt wird bei
 * Ausstellung eingefroren (Aussteller, Empfänger, Positionen) und nie geändert (GoBD).
 * Ausgestellt wird nur, wenn die Angaben des Ausstellers in der Plattform hinterlegt sind.
 * Pflichtangaben nach § 14 UStG – Kleinunternehmer-, Reverse-Charge- u. ä. Fälle [PRÜFEN].
 */
export type Issuer = { name: string; address: string; taxId: string; iban: string; email: string };

export function invoiceIssuer(): Issuer | null {
  const name = setting("INVOICE_ISSUER_NAME")?.trim();
  const address = setting("INVOICE_ISSUER_ADDRESS")?.trim();
  const taxId = setting("INVOICE_TAX_ID")?.trim();
  if (!name || !address || !taxId) return null;
  return { name, address, taxId, iban: setting("INVOICE_IBAN")?.trim() ?? "", email: setting("INVOICE_EMAIL")?.trim() ?? "" };
}

/** Nächste Rechnungsnummer des Jahres (atomar, auch bei gleichzeitigen Abschlüssen). */
export async function nextInvoiceNumber(year: number): Promise<string> {
  const c = await prisma.invoiceCounter.upsert({ where: { year }, create: { year, last: 1 }, update: { last: { increment: 1 } } });
  return `${year}-${String(c.last).padStart(4, "0")}`;
}

/** Rechnung zu einem festgeschriebenen Monat – höchstens eine je Kunde und Monat. */
export async function issueInvoice(snap: BillingSnapshot, now = new Date()) {
  const preview = snap.invoice as unknown as InvoicePreview;
  if (!preview || preview.netCents <= 0) return null;
  const existing = await prisma.invoice.findUnique({ where: { tenantId_year_month: { tenantId: snap.tenantId, year: snap.year, month: snap.month } } });
  if (existing) return existing;
  const issuer = invoiceIssuer();
  if (!issuer) {
    logger.warn("invoice.issuer_missing", { tenantId: snap.tenantId, period: `${snap.year}-${snap.month}` });
    return null;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: snap.tenantId }, select: { billingAddress: true, billingVatId: true } });
  const days = Math.max(0, settingNumber("INVOICE_PAYMENT_DAYS", 14));
  const inv = await prisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(now.getUTCFullYear()),
      tenantId: snap.tenantId, year: snap.year, month: snap.month, issuedAt: now, dueAt: new Date(now.getTime() + days * 86400_000),
      issuer, recipient: { name: snap.tenantName, address: tenant?.billingAddress ?? "", vatId: tenant?.billingVatId ?? "" },
      lines: preview.lines, netCents: preview.netCents, vatPercent: preview.vatPercent, vatCents: preview.vatCents, grossCents: preview.grossCents,
      partial: snap.partial,
    },
  });
  logger.info("invoice.issued", { tenantId: snap.tenantId, number: inv.number });
  const admins = await prisma.user.findMany({ where: { tenantId: snap.tenantId, role: "TENANT_ADMIN", disabled: false }, select: { email: true } });
  const link = `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/invoice/${inv.id}`;
  for (const a of admins) {
    await sendEmail({
      tenantId: snap.tenantId, to: a.email, purpose: "BILLING_NOTICE", fromName: issuer.name,
      subject: `Rechnung ${inv.number} – ${String(snap.month).padStart(2, "0")}/${snap.year}`,
      html: emailLayout(`<p>Guten Tag,</p><p>Ihre Rechnung <b>${h(inv.number)}</b> über <b>${(inv.grossCents / 100).toFixed(2).replace(".", ",")} €</b> ist im Portal abrufbar:<br/><a href="${h(link)}">${h(link)}</a></p><p>Zahlbar bis ${inv.dueAt.toLocaleDateString("de-DE")}.</p>`, h(issuer.name)),
    });
  }
  return inv;
}
