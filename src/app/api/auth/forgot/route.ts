import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, readJson } from "@/lib/http";
import { sendPasswordResetEmail } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** Antwortet immer gleich – verrät nicht, ob die E-Mail existiert. */
export const POST = api(async (req) => {
  const { email } = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()) }).parse(await readJson(req));
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.disabled) await sendPasswordResetEmail(user);
  return NextResponse.json({ ok: true });
});
