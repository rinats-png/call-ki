import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { requireModule } from "@/lib/addons";

export const dynamic = "force-dynamic";

/** Aufgabe anlegen (optional zu einem Vorgang und für eine Person) */
export const POST = api(async (req) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "planning");
  const d = z.object({ title: z.string().trim().min(1).max(200), note: z.string().trim().max(2000).default(""), dueAt: z.string().datetime().nullable().optional(), assigneeId: z.string().nullable().optional(), ticketId: z.string().nullable().optional() }).parse(await readJson(req));
  if (d.assigneeId && !(await prisma.user.count({ where: { id: d.assigneeId, tenantId: auth.tenantId } }))) throw notFound("Person");
  if (d.ticketId && !(await prisma.callTicket.count({ where: { id: d.ticketId, tenantId: auth.tenantId } }))) throw notFound("Vorgang");
  const t = await prisma.task.create({ data: { tenantId: auth.tenantId, title: d.title, note: d.note, dueAt: d.dueAt ? new Date(d.dueAt) : null, assigneeId: d.assigneeId ?? null, ticketId: d.ticketId ?? null, createdById: auth.user.id } });
  return NextResponse.json(t, { status: 201 });
});
