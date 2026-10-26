import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { cancelInvoice, convertQuote, issueBill, markPaid, sendBill } from "@/lib/services/bills";
import { requireModule } from "@/lib/addons";

export const dynamic = "force-dynamic";
type P = { id: string };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("issue") }),
  z.object({ action: z.literal("send"), to: z.string().email().optional() }),
  z.object({ action: z.literal("paid"), method: z.string().trim().min(1).max(40).default("Überweisung") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().max(200).default("") }),
  z.object({ action: z.literal("convert") }),
  z.object({ action: z.literal("remind") }),
  z.object({ action: z.literal("decline") }),
]);

/** Statuswechsel eines Belegs */
export const POST = api<P>(async (req, { params }) => {
  const d = body.parse(await readJson(req));
  const auth = await requireTenant({ adminOnly: d.action === "cancel" });
  // Offene Posten abschließen (bezahlt, stornieren) geht auch nach Kündigung der Zusatzoption
  if (d.action !== "paid" && d.action !== "cancel") await requireModule(auth.tenantId, "invoicing");
  const { id } = await params;
  let result: unknown = { ok: true };
  switch (d.action) {
    case "issue": result = await issueBill(auth.tenantId, id); break;
    case "send": result = await sendBill(auth.tenantId, id, { to: d.to }); break;
    case "paid": await markPaid(auth.tenantId, id, d.method); break;
    case "cancel": result = await cancelInvoice(auth.tenantId, id, d.reason); break;
    case "convert": result = await convertQuote(auth.tenantId, id); break;
    case "remind": {
      const b = await prisma.bill.findFirst({ where: { id, tenantId: auth.tenantId }, select: { kind: true, status: true, reminderLevel: true } });
      if (!b) throw notFound("Beleg");
      if (b.kind !== "INVOICE" || b.status !== "ISSUED") throw new HttpError(409, "Nur offene Rechnungen können angemahnt werden.");
      result = await sendBill(auth.tenantId, id, { level: Math.min(b.reminderLevel + 1, 2) });
      break;
    }
    case "decline": {
      const r = await prisma.bill.updateMany({ where: { id, tenantId: auth.tenantId, kind: "QUOTE", status: "ISSUED" }, data: { status: "DECLINED" } });
      if (!r.count) throw new HttpError(409, "Nur offene Angebote können abgelehnt werden.");
      break;
    }
  }
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `bill.${d.action}`, target: id });
  return NextResponse.json(result);
});
