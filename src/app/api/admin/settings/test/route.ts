import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { testProvider } from "@/lib/platform/tests";
import { enforceShared, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** „Verbindung testen“ – lesender Aufruf beim Anbieter */
export const POST = api(async (req) => {
  const auth = await requirePlatformAdmin();
  await enforceShared(`settings-test:${auth.user.id}`, LIMITS.settingsTestPerUser);
  const { provider } = z.object({ provider: z.string().max(40) }).parse(await readJson(req));
  return NextResponse.json(await testProvider(provider));
});
