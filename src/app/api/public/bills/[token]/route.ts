import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { girocodePayload, type Issuer } from "@/lib/services/bills";
import { clientIp, enforce } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
type P = { token: string };

/** Öffentliche Ansicht eines ausgestellten Belegs über den zufälligen Link (für den Endkunden). */
export const GET = api<P>(async (req, { params }) => {
  const { token } = await params;
  enforce(`public-bill:${await clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound("Beleg");
  const b = await prisma.bill.findUnique({ where: { publicToken: token } });
  if (!b || b.status === "DRAFT") throw notFound("Beleg");
  const issuer = b.issuer as unknown as Issuer;
  const payable = b.kind === "INVOICE" && b.status === "ISSUED";
  const payload = payable ? girocodePayload({ name: issuer.name, iban: issuer.iban, bic: issuer.bic, amountCents: b.grossCents, reference: `Rechnung ${b.number}` }) : null;
  const qrSvg = payload ? await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  return NextResponse.json(
    { kind: b.kind, status: b.status, number: b.number, issueDate: b.issueDate, serviceDate: b.serviceDate, dueAt: b.dueAt, issuer, recipient: b.recipient, lines: b.lines, taxes: b.taxes, netCents: b.netCents, taxCents: b.taxCents, grossCents: b.grossCents, smallBusiness: b.smallBusiness, introText: b.introText, note: b.kind === "CREDIT_NOTE" ? b.note : null, paidAt: b.paidAt, qrSvg },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
});
