import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, notFound, readJson, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Leistungskatalog des eigenen Betriebs (alle Benutzer lesen, Admins ändern) */
export const GET = api(async () => {
  const auth = await requireTenant();
  const services = await prisma.service.findMany({ where: { tenantId: auth.tenantId }, orderBy: [{ active: "desc" }, { sort: "asc" }, { name: "asc" }] });
  const trades = [...new Set(services.map((s) => s.trade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  return NextResponse.json({ services, trades });
});

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  aliases: z.string().trim().max(400).default(""),
  trade: z.string().trim().max(60).default(""),
  durationMin: z.number().int().min(0).max(1440).default(60),
  priceCents: z.number().int().min(0).max(100_000_00).default(0),
  unit: z.string().trim().min(1).max(20).default("pauschal"),
  taxRate: z.union([z.literal(0), z.literal(7), z.literal(19)]).default(19),
  active: z.boolean().default(true),
  sort: z.number().int().min(0).max(9999).default(0),
});

/** Anlegen oder (mit id) aktualisieren */
export const POST = api(async (req) => {
  const auth = await requireTenant({ adminOnly: true });
  const { id, ...data } = serviceSchema.parse(await readJson(req));
  if (id && !(await prisma.service.count({ where: { id, tenantId: auth.tenantId } }))) throw notFound("Leistung");
  const clash = await prisma.service.findFirst({ where: { tenantId: auth.tenantId, name: data.name, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) throw new HttpError(409, "Eine Leistung mit diesem Namen gibt es schon.");
  const s = id ? await prisma.service.update({ where: { id }, data }) : await prisma.service.create({ data: { ...data, tenantId: auth.tenantId } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: id ? "service.update" : "service.create", target: s.id, meta: { name: s.name } });
  return NextResponse.json(s, { status: id ? 200 : 201 });
});
