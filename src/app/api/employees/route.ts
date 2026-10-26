import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { EMPLOYEE_ROLES } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const auth = await requireTenant();
  const employees = await prisma.employee.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { tickets: { where: { status: { in: ["PENDING", "ESCALATED"] } } } } }, appToken: { select: { createdAt: true } } },
  });
  return NextResponse.json(employees.map(({ _count, appToken, ...e }) => ({ ...e, openTickets: _count.tickets, appLinkAt: appToken?.createdAt ?? null })));
});

const AREA = /^(\s*(\*|\d{1,5}(\s*-\s*\d{1,5})?)\s*)(,\s*(\*|\d{1,5}(\s*-\s*\d{1,5})?)\s*)*$/;
const employeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  role: z.enum(EMPLOYEE_ROLES),
  email: z.string().email().or(z.literal("")).nullable().optional(),
  servicePostalCodes: z.string().regex(AREA, "Format: 10115, 12, 13000-13999 oder *"),
  directPhone: z.string().max(30).nullable().optional(),
  trades: z.string().trim().max(200).optional(),
  baseAddress: z.string().trim().max(200).nullable().optional(),
  maxTravelMin: z.number().int().min(5).max(300).nullable().optional(),
  active: z.boolean().optional(),
});

/** Anlegen oder (mit id) aktualisieren. Löschen = deaktivieren (Historie bleibt erhalten). */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id, directPhone, email, ...rest } = employeeSchema.parse(await readJson(req));
  const data = { ...rest, email: email || null, directPhone: normalizePhone(directPhone) };
  if (id && !(await prisma.employee.count({ where: { id, tenantId: auth.tenantId } }))) throw notFound("Mitarbeiter");
  const e = id ? await prisma.employee.update({ where: { id }, data }) : await prisma.employee.create({ data: { ...data, tenantId: auth.tenantId } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: id ? "employee.update" : "employee.create", target: e.id });
  return NextResponse.json(e, { status: id ? 200 : 201 });
});
