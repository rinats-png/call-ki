import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/addons";
import { importStatement } from "@/lib/services/bank-import";
import { clientIp, enforce } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const MAX_BYTES = 5 * 1024 * 1024;

/** Offene Vorschläge aus früheren Importen (bitte prüfen) */
export const GET = api(async () => {
  const auth = await requireTenant();
  const rows = await prisma.bankTransaction.findMany({ where: { tenantId: auth.tenantId, status: "SUGGESTED" }, orderBy: { bookingDate: "desc" }, take: 100 });
  const bills = await prisma.bill.findMany({ where: { tenantId: auth.tenantId, id: { in: rows.map((r) => r.billId).filter((x): x is string => !!x) } }, select: { id: true, number: true, grossCents: true, status: true, customer: { select: { name: true, companyName: true } } } });
  return NextResponse.json({ suggestions: rows.map((r) => ({ ...r, bill: bills.find((b) => b.id === r.billId) ?? null })) });
});

/** Kontoauszug hochladen (CAMT-XML oder CSV als Text, max. 5 MB) – nur Kunden-Admins */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  await requireModule(auth.tenantId, "invoicing");
  enforce(`bank-import:${auth.tenantId}:${await clientIp(req)}`, { limit: 20, windowMs: 3600_000 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) throw new HttpError(413, "Datei zu groß (max. 5 MB).");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BYTES) throw new HttpError(413, "Datei zu groß (max. 5 MB).");
  if (!text.trim()) throw new HttpError(400, "Leere Datei.");
  const r = await importStatement(auth.tenantId, text);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "bills.bank_import", meta: { credits: r.credits, matched: r.matched.length, suggested: r.suggested } });
  return NextResponse.json(r);
});
