import { NextResponse } from "next/server";
import { ensurePlatformConfig, setting } from "@/lib/platform/config";
import { logger } from "@/lib/logger";
import { verifyElevenLabsSignature } from "@/lib/security";
import { handleCallEvent } from "@/lib/services/calls";
import { parseElevenLabsEvent } from "@/lib/voice/events";
import { clientIp, hit, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** ElevenLabs Post-Call-Webhook (post_call_transcription) – Signatur per HMAC geprüft. */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const wait = hit(`webhook:ip:${await clientIp(req)}`, LIMITS.webhookPerIp);
  if (wait) return NextResponse.json({ error: "Too Many Requests" }, { status: 429, headers: { "Retry-After": String(wait) } });
  const raw = await req.text();
  if (raw.length > 5 * 1024 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyElevenLabsSignature(raw, req.headers.get("elevenlabs-signature"), setting("ELEVENLABS_WEBHOOK_SECRET"))) {
    logger.warn("elevenlabs.invalid_signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Audio-Webhooks (post_call_audio) werden bewusst nicht gespeichert
  const ev = parseElevenLabsEvent(body);
  if (!ev) return NextResponse.json({ ok: true, ignored: true });
  try {
    const call = await handleCallEvent(ev);
    return NextResponse.json({ ok: true, callId: call?.id ?? null });
  } catch (err) {
    logger.error("elevenlabs.event_failed", { error: (err as Error).message });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
