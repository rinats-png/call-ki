import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { api, HttpError, readJson } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/auth/crypto";
import { safeEqual } from "@/lib/security";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Ersteinrichtung: legt den ersten Plattform-Admin an – nur solange es keinen gibt und mit SETUP_TOKEN. */
export const GET = api(async () => {
  const admins = await prisma.user.count({ where: { role: "PLATFORM_ADMIN" } });
  return NextResponse.json({ needed: admins === 0, tokenConfigured: !!env().SETUP_TOKEN });
});

const schema = z.object({
  setupToken: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string(),
});

export const POST = api(async (req) => {
  const data = schema.parse(await readJson(req));
  const expected = env().SETUP_TOKEN;
  if (!expected) throw new HttpError(503, "SETUP_TOKEN ist auf dem Server nicht gesetzt.");
  if (!safeEqual(data.setupToken, expected)) throw new HttpError(403, "Setup-Token ist falsch.");
  const problem = passwordProblem(data.password);
  if (problem) throw new HttpError(400, problem);

  const user = await prisma.$transaction(async (tx) => {
    if ((await tx.user.count({ where: { role: "PLATFORM_ADMIN" } })) > 0) throw new HttpError(409, "Die Einrichtung ist bereits abgeschlossen.");
    return tx.user.create({ data: { email: data.email, name: data.name, role: "PLATFORM_ADMIN", passwordHash: await hashPassword(data.password) } });
  });
  await createSession(user.id);
  await audit({ userId: user.id, action: "platform.setup" });
  return NextResponse.json({ ok: true }, { status: 201 });
});
