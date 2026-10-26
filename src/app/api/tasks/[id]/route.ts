import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { requireModule } from "@/lib/addons";

export const dynamic = "force-dynamic";
type P = { id: string };

export const PATCH = api<P>(async (req, { params }) => {
  const auth = await requireTenant();
  await requireModule(auth.tenantId, "planning");
  const { id } = await params;
  const d = z.object({ done: z.boolean().optional(), title: z.string().trim().min(1).max(200).optional(), dueAt: z.string().datetime().nullable().optional(), assigneeId: z.string().nullable().optional() }).parse(await readJson(req));
  if (d.assigneeId && !(await prisma.user.count({ where: { id: d.assigneeId, tenantId: auth.tenantId } }))) throw notFound("Person");
  const r = await prisma.task.updateMany({
    where: { id, tenantId: auth.tenantId },
    data: { ...(d.done !== undefined ? { doneAt: d.done ? new Date() : null } : {}), ...(d.title ? { title: d.title } : {}), ...(d.dueAt !== undefined ? { dueAt: d.dueAt ? new Date(d.dueAt) : null } : {}), ...(d.assigneeId !== undefined ? { assigneeId: d.assigneeId } : {}) },
  });
  if (!r.count) throw notFound("Aufgabe");
  return NextResponse.json({ ok: true });
});

export const DELETE = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const r = await prisma.task.deleteMany({ where: { id, tenantId: auth.tenantId } });
  if (!r.count) throw notFound("Aufgabe");
  return NextResponse.json({ ok: true });
});
