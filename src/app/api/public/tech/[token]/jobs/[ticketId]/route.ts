import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/http";
import { clientIp, enforce } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { employeeForToken, finishJob, reportText, setJobStatus, signatureFromDataUrl, updateJob, type Material } from "@/lib/services/jobs";
import { onJobEnRoute } from "@/lib/services/job-contact";

export const dynamic = "force-dynamic";
type P = { token: string; ticketId: string };

const material = z.object({ description: z.string().trim().max(200), quantity: z.number().min(0).max(10000), unit: z.string().trim().max(20).default("Stück"), unitCents: z.number().int().min(0).max(10_000_000), serviceId: z.string().nullable().optional() });
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["EN_ROUTE", "ON_SITE"]) }),
  z.object({ action: z.literal("save"), findings: z.string().max(4000).optional(), workDone: z.string().max(4000).optional(), materials: z.array(material).max(50).optional(), hoursWorked: z.number().min(0).max(24).optional() }),
  z.object({ action: z.literal("finish"), signatureName: z.string().trim().max(80).nullable().optional(), signature: z.string().max(280_000).nullable().optional() }),
  z.object({ action: z.literal("text") }),
]);

/** Wie readJson, aber mit 300 KB Limit: die Unterschrift kommt als PNG-Data-URL mit. */
async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > 300_000) throw new HttpError(413, "Anfrage zu groß");
  const text = await req.text();
  if (Buffer.byteLength(text) > 300_000) throw new HttpError(413, "Anfrage zu groß");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Ungültiges JSON");
  }
}

/** Techniker-App: Status, Bericht speichern, Abschluss mit Unterschrift */
export const POST = api<P>(async (req, { params }) => {
  const { token, ticketId } = await params;
  enforce(`tech:${await clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  const e = await employeeForToken(token);
  const d = body.parse(await readBody(req));
  switch (d.action) {
    case "status": {
      const r = await setJobStatus(e, ticketId, d.status);
      if (d.status === "EN_ROUTE" && r.firstTime) await onJobEnRoute(e.tenantId, ticketId, e.name).catch(() => undefined);
      return NextResponse.json(r.report);
    }
    case "save": {
      return NextResponse.json(await updateJob(e, ticketId, { findings: d.findings, workDone: d.workDone, materials: d.materials, hoursWorked: d.hoursWorked }));
    }
    case "finish": {
      const r = await finishJob(e, ticketId, { signatureName: d.signatureName, signaturePng: signatureFromDataUrl(d.signature) });
      await audit({ tenantId: e.tenantId, userId: null, action: "job.finish", target: ticketId, meta: { employeeId: e.id, billId: r.billId } });
      return NextResponse.json(r);
    }
    case "text": {
      const t = await prisma.callTicket.findFirst({ where: { id: ticketId, tenantId: e.tenantId, assignedEmployeeId: e.id }, include: { jobReport: true } });
      const rep = t?.jobReport;
      return NextResponse.json({ text: t ? reportText({ category: t.category, summary: t.summary, findings: rep?.findings ?? "", workDone: rep?.workDone ?? "", materials: (rep?.materials as unknown as Material[]) ?? [], hoursWorked: rep?.hoursWorked ?? 0, arrivedAt: rep?.arrivedAt ?? null, finishedAt: rep?.finishedAt ?? null, employeeName: e.name }) : "" });
    }
  }
});
