import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { destroySession } from "@/lib/auth/session";

export const POST = api(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
