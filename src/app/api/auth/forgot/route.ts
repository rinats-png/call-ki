import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { sendPasswordResetEmail } from "@/lib/services/users";
import { clientIp, enforceShared, hitShared, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Antwortet immer gleich – verrät nicht, ob die E-Mail existiert. */
export const POST = api(async (req) => {
  await enforceShared(`reset:ip:${await clientIp(req)}`, LIMITS.resetPerIp);
  const { email } = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()) }).parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });
  // Pro Konto still begrenzen: gleiche Antwort, aber keine E-Mail-Flut
  if (user && !user.disabled && (await hitShared(`reset:acct:${user.id}`, LIMITS.resetPerAccount)) === 0) await sendPasswordResetEmail(user);
  return NextResponse.json({ ok: true });
});
