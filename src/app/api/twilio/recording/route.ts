import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { say, twimlResponse } from "@/lib/twiml";
import { resolveConfig } from "@/lib/tenant/settings";
import { createCallbackTicket } from "@/lib/services/calls";
import { twilioParams } from "@/lib/voice/inbound";

export const dynamic = "force-dynamic";

/** Mailbox-Aufnahme → Rückruf-Ticket beim richtigen Mandanten. */
export async function POST(req: Request) {
  const params = await twilioParams(req);
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) return new Response("Forbidden", { status: 403 });

  const callId = new URL(req.url).searchParams.get("call");
  const call = callId ? await prisma.call.findUnique({ where: { id: callId }, include: { tenant: true } }) : null;
  if (call && params.RecordingUrl) {
    try {
      const duration = Number(params.RecordingDuration) || 0;
      await prisma.call.update({ where: { id: call.id }, data: { status: "VOICEMAIL", recordingUrl: params.RecordingUrl, durationSec: duration, endedAt: new Date() } });
      await createCallbackTicket(call.tenant, resolveConfig(call.tenant), { ...call, recordingUrl: params.RecordingUrl }, `Sprachnachricht (${duration} s) – bitte abhören und zurückrufen.`);
    } catch (err) {
      logger.error("twilio.recording_failed", { error: (err as Error).message });
    }
  }
  return twimlResponse(say("Vielen Dank für Ihre Nachricht. Wir melden uns schnellstmöglich. Auf Wiederhören.") + "<Hangup/>");
}
