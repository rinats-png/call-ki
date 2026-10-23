import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { consumeAuthToken } from "@/lib/services/users";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(10), password: z.string(), name: z.string().trim().max(80).optional(), type: z.enum(["INVITE", "PASSWORD_RESET"]) });

/** Einladung annehmen bzw. Passwort zurücksetzen – setzt Passwort, beendet alte Sitzungen, meldet an. */
export const POST = api(async (req) => {
  const data = schema.parse(await readJson(req));
  const problem = passwordProblem(data.password);
  if (problem) throw new HttpError(400, problem);
  const rec = await consumeAuthToken(data.token, data.type);
  if (!rec) throw new HttpError(410, "Der Link ist ungültig oder abgelaufen. Bitte neuen Link anfordern.");

  await prisma.$transaction([
    prisma.authToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: rec.userId },
      data: { passwordHash: await hashPassword(data.password), failedLogins: 0, lockedUntil: null, ...(data.name ? { name: data.name } : {}) },
    }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }),
  ]);
  await createSession(rec.userId);
  await audit({ tenantId: rec.user.tenantId, userId: rec.userId, action: data.type === "INVITE" ? "auth.invite_accepted" : "auth.password_reset" });
  return NextResponse.json({ ok: true });
});
