import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/addons";
import { resolveConfig } from "@/lib/tenant/settings";
import { moveAppointment } from "@/lib/services/planning";

export const dynamic = "force-dynamic";
type P = { ticketId: string };

/** Termin verschieben oder ungeplanten Vorgang einplanen (Ziehen im Teamkalender) */
export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "planning");
  const { ticketId } = await params;
  const d = z.object({ employeeId: z.string().min(1), start: z.string().datetime(), durationMin: z.number().int().min(15).max(720).optional(), notifyCustomer: z.boolean().default(true) }).parse(await readJson(req));
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId } });
  const r = await moveAppointment(tenant, resolveConfig(tenant), ticketId, { ...d, start: new Date(d.start), userName: auth.user.name ?? auth.user.email });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "planning.move", target: ticketId, meta: { employeeId: d.employeeId, start: d.start, notifyCustomer: d.notifyCustomer } });
  return NextResponse.json({ ok: true, start: r.appointment.start, end: r.appointment.end });
});
