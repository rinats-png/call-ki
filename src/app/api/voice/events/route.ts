import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { verifyVoiceRequest } from "@/lib/security";
import { attachCallRecord } from "@/lib/services/tickets";
import { parseCallEndEvent } from "@/lib/voice/events";

export const dynamic = "force-dynamic";

/** Webhook für Gesprächsende (Retell Agent Webhook / Vapi Server URL). Speichert Transkript & Zusammenfassung. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyVoiceRequest(req, raw)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ev = parseCallEndEvent(body);
  if (!ev) return NextResponse.json({ ok: true, ignored: true }); // andere Event-Typen bestätigen

  const phone = normalizePhone(ev.phone);
  if (!phone) {
    logger.warn("voice.event_no_phone", { callId: ev.callId });
    return NextResponse.json({ ok: true, ignored: "no caller number" });
  }

  try {
    const ticket = await attachCallRecord({ phone, transcript: ev.transcript, summary: ev.summary, durationSec: ev.durationSec });
    logger.info("voice.call_recorded", { callId: ev.callId, provider: ev.provider, ticketId: ticket?.id ?? null });
    return NextResponse.json({ ok: true, ticketId: ticket?.id ?? null });
  } catch (err) {
    logger.error("voice.event_failed", { callId: ev.callId, error: (err as Error).message });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
