import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EMPLOYEE_ROLES } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function GET() {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tickets: { where: { status: { in: ["PENDING", "ESCALATED"] } } } } } },
  });
  return NextResponse.json(employees.map(({ _count, ...e }) => ({ ...e, openTickets: _count.tickets })));
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  role: z.enum(EMPLOYEE_ROLES),
  microsoftUpn: z.string().email(),
  servicePostalCodes: z.string().regex(/^(\s*(\*|\d{1,5}(\s*-\s*\d{1,5})?)\s*)(,\s*(\*|\d{1,5}(\s*-\s*\d{1,5})?)\s*)*$/, "Format: 10115, 12, 13000-13999 oder *"),
  directPhone: z.string().optional().nullable(),
});

/** Mitarbeiter anlegen oder (mit id) aktualisieren. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, directPhone, ...data } = parsed.data;
  const payload = { ...data, directPhone: normalizePhone(directPhone) };
  const employee = id
    ? await prisma.employee.update({ where: { id }, data: payload })
    : await prisma.employee.create({ data: payload });
  return NextResponse.json(employee, { status: id ? 200 : 201 });
}
