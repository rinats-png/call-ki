import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError, readJson } from "@/lib/http";
import { requireAuth, requireRecentAuth } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { checkNewPassword } from "@/lib/auth/pwned";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Eigenes Passwort ändern; beendet alle anderen Sitzungen. */
export const POST = api(async (req) => {
  const auth = await requireAuth({ allowMfaSetup: true });
  requireRecentAuth(auth);
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().max(200) }).parse(await readJson(req));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new HttpError(401, "Das aktuelle Passwort ist falsch.");
  const problem = await checkNewPassword(newPassword);
  if (problem) throw new HttpError(400, problem);
  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { userId: auth.user.id, id: { not: auth.sessionId } } }),
  ]);
  await audit({ tenantId: auth.user.tenantId, userId: auth.user.id, action: "auth.password_changed" });
  return NextResponse.json({ ok: true });
});
