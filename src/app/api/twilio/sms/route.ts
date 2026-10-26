import { logger } from "@/lib/logger";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { twilioParams } from "@/lib/voice/inbound";
import { handleInboundSms } from "@/lib/services/sms-replies";

export const dynamic = "force-dynamic";

/** Twilio „A message comes in“ der SMS-Absendernummer: Antworten auf Terminerinnerungen. */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const params = await twilioParams(req);
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    logger.warn("twilio.sms_invalid_signature");
    return new Response("Forbidden", { status: 403 });
  }
  if (params.From && params.Body) await handleInboundSms(params.From, params.Body);
  // Antworten gehen über sendSms (protokolliert, mit Wiederholung) – hier keine TwiML-Antwort
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
