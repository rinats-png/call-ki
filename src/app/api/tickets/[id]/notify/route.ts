import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { loadTenant } from "@/lib/tenant";
import { isSlotFree } from "@/lib/calendar";
import { notifyForTicket } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

const schema = z.object({ appointmentStart: z.string().datetime({ offset: true }).optional() });

/** Termin (neu) setzen und/oder Benachrichtigungen erneut auslösen – z. B. nach Rückruf durch das Büro. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const { tenant, cfg } = await loadTenant(auth.tenantId);
  const body = schema.parse(await readJson(req).catch(() => ({})));
  let ticket = await prisma.callTicket.findFirst({ where: { id, tenantId: tenant.id }, include: { customer: true, assignedEmployee: true } });
  if (!ticket) throw notFound("Vorgang");

  let appointment = ticket.appointmentStart && ticket.appointmentEnd ? { start: ticket.appointmentStart, end: ticket.appointmentEnd } : null;
  if (body.appointmentStart) {
    if (!ticket.assignedEmployee) throw new HttpError(400, "Bitte zuerst einen Mitarbeiter zuweisen.");
    const start = new Date(body.appointmentStart);
    const slot = { start, end: new Date(start.getTime() + cfg.durationMin * 60000) };
    if (!(await isSlotFree(tenant.id, cfg, ticket.assignedEmployee, slot, ticket.id))) throw new HttpError(409, "Der Mitarbeiter ist zu dieser Zeit bereits verplant.");
    ticket = await prisma.callTicket.update({
      where: { id }, data: { appointmentStart: slot.start, appointmentEnd: slot.end, calendarEventId: null, status: ticket.status === "PENDING" ? "PROCESSED" : ticket.status },
      include: { customer: true, assignedEmployee: true },
    });
    appointment = slot;
  }
  const result = await notifyForTicket(tenant, cfg, ticket, ticket.assignedEmployee, appointment, { force: true });
  return NextResponse.json({ result }, { status: result.errors.length ? 207 : 200 });
});
