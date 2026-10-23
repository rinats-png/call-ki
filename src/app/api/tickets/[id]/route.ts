import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, badRequest } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { TICKET_STATUS, URGENCIES } from "@/lib/constants";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Anbieter-URL der Aufnahme nicht an den Browser geben (Abspielen über eigenen Endpunkt). */
function hideProviderUrls<T extends { call: { id: string; recordingUrl: string | null } | null }>(t: T): T {
  return t.call ? { ...t, call: { ...t.call, recordingUrl: t.call.recordingUrl ? `/api/calls/${t.call.id}/recording` : null } } : t;
}

const include = {
  customer: true,
  assignedEmployee: true,
  call: { select: { id: true, startedAt: true, durationSec: true, recordingUrl: true, endReason: true } },
  messages: { orderBy: { createdAt: "desc" as const }, select: { id: true, channel: true, recipient: true, subject: true, purpose: true, status: true, error: true, createdAt: true } },
};

export const GET = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const ticket = await prisma.callTicket.findFirst({ where: { id, tenantId: auth.tenantId }, include });
  if (!ticket) throw notFound("Vorgang");
  return NextResponse.json(hideProviderUrls(ticket));
});

const patchSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  urgency: z.enum(URGENCIES).optional(),
  assignedEmployeeId: z.string().nullable().optional(),
  summary: z.string().max(4000).optional(),
  notes: z.string().max(8000).optional(),
  category: z.string().max(60).optional(),
});

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const data = patchSchema.parse(await readJson(req));
  const ticket = await prisma.callTicket.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!ticket) throw notFound("Vorgang");
  if (data.assignedEmployeeId) {
    const ok = await prisma.employee.count({ where: { id: data.assignedEmployeeId, tenantId: auth.tenantId } });
    if (!ok) throw badRequest("Mitarbeiter gehört nicht zu diesem Konto");
  }
  const updated = hideProviderUrls(await prisma.callTicket.update({ where: { id }, data, include }));
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "ticket.update", target: id, meta: Object.keys(data) });
  return NextResponse.json(updated);
});
