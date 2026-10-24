import { logger } from "@/lib/logger";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { prisma } from "@/lib/db";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { twilioParams } from "@/lib/voice/inbound";

export const dynamic = "force-dynamic";

const FINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

/**
 * Twilio „Call status changes“ (StatusCallback der Rufnummer): unabhängiges Gesprächsende.
 * Setzt Ende und Twilio-Dauer (Abrechnung), auch wenn der KI-Anbieter kein Ereignis schickt.
 * Den Status lässt sie stehen – fehlt das Anbieter-Ereignis, schließt der Cron den Anruf
 * (closeStaleCalls) und legt bei Bedarf ein Rückruf-Ticket an.
 */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const params = await twilioParams(req);
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    logger.warn("twilio.status_invalid_signature");
    return new Response("Forbidden", { status: 403 });
  }
  if (!FINAL.has(params.CallStatus ?? "")) return new Response(null, { status: 204 });
  const call = params.CallSid ? await prisma.call.findUnique({ where: { twilioCallSid: params.CallSid }, select: { id: true, endedAt: true } }) : null;
  if (!call) return new Response(null, { status: 204 });
  const duration = Number.parseInt(params.CallDuration ?? "", 10);
  await prisma.call.update({
    where: { id: call.id },
    data: {
      twilioDurationSec: Number.isFinite(duration) ? duration : 0,
      ...(call.endedAt ? {} : { endedAt: new Date() }),
    },
  });
  return new Response(null, { status: 204 });
}
