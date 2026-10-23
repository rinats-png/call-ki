import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyVoiceRequest } from "@/lib/security";
import { handleCallEvent } from "@/lib/services/calls";
import { parseCallEvent } from "@/lib/voice/events";

export const dynamic = "force-dynamic";

/** Retell Agent-Webhook (call_started/ended/analyzed) bzw. Vapi end-of-call-report. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyVoiceRequest(req, raw)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ev = parseCallEvent(body);
  if (!ev) return NextResponse.json({ ok: true, ignored: true });
  try {
    const call = await handleCallEvent(ev);
    return NextResponse.json({ ok: true, callId: call?.id ?? null });
  } catch (err) {
    logger.error("voice.event_failed", { callId: ev.callId, error: (err as Error).message });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
