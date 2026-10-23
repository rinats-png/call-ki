import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { syncOutlook } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

const schema = z.object({ appointmentStart: z.string().datetime({ offset: true }).optional() });

/** Outlook-Termin / -Entwurf (erneut) anlegen – z. B. nach Graph-Störung oder für manuell vereinbarte Termine. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const ticket = await prisma.callTicket.findUnique({ where: { id }, include: { customer: true, assignedEmployee: true } });
  if (!ticket) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const start = parsed.data.appointmentStart ? new Date(parsed.data.appointmentStart) : null;
  const appointment = start ? { start, end: new Date(start.getTime() + env().APPOINTMENT_DURATION_MIN * 60000) } : null;
  const result = await syncOutlook(ticket, ticket.assignedEmployee, appointment);
  const fresh = await prisma.callTicket.findUnique({ where: { id }, include: { customer: true, assignedEmployee: true } });
  return NextResponse.json({ result, ticket: fresh }, { status: result.errors.length ? 502 : 200 });
}
