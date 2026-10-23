import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { TICKET_STATUS, URGENCIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const ticket = await prisma.callTicket.findUnique({ where: { id }, include: { customer: true, assignedEmployee: true } });
  if (!ticket) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(ticket);
}

const patchSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  urgency: z.enum(URGENCIES).optional(),
  assignedEmployeeId: z.string().nullable().optional(),
  summary: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const ticket = await prisma.callTicket.update({ where: { id }, data: parsed.data, include: { customer: true, assignedEmployee: true } });
    return NextResponse.json(ticket);
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}
