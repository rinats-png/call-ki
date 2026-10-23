import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { say, twimlResponse } from "@/lib/twiml";
import { attachCallRecord } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

/** <Record action> der Mailbox: legt ein Rückruf-Ticket mit Link zur Sprachnachricht an. */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const phone = normalizePhone(params.From);
  if (phone && params.RecordingUrl) {
    try {
      await attachCallRecord({
        phone,
        summary: `Sprachnachricht (${params.RecordingDuration ?? "?"} s): ${params.RecordingUrl}`,
        durationSec: Number(params.RecordingDuration) || null,
        transcript: null,
        forceCallback: true,
      });
    } catch (err) {
      logger.error("twilio.recording_failed", { error: (err as Error).message });
    }
  }
  return twimlResponse(say("Vielen Dank für Ihre Nachricht. Wir melden uns schnellstmöglich. Auf Wiederhören.") + "<Hangup/>");
}
