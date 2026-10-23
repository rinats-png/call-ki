import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { dialSip, twimlResponse } from "@/lib/twiml";
import { fallbackTwiml } from "@/lib/voice/fallback";
import { findCustomerByPhone } from "@/lib/services/customers";
import { registerRetellCall } from "@/lib/voice/retell";

export const dynamic = "force-dynamic";

/**
 * Twilio "A call comes in" Webhook.
 * Erkennt den Anrufer (Neu-/Bestandskunde) und übergibt an die Sprach-KI:
 *  - Retell: Registrierung + SIP-Weiterleitung, Kundendaten als Dynamic Variables
 *  - Vapi:   Redirect auf den Vapi-Twilio-Endpunkt (Nummer muss in Vapi importiert sein)
 * Bei Fehlern greift die Weiterleitung ins Büro, damit kein Anruf verloren geht.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    logger.warn("twilio.invalid_signature", { url: publicUrl(req) });
    return new Response("Forbidden", { status: 403 });
  }

  const e = env();
  const from = normalizePhone(params.From) ?? "anonymous";
  const to = params.To ?? "";
  logger.info("twilio.inbound", { callSid: params.CallSid, from: maskPhone(from) });

  try {
    if (e.VOICE_PROVIDER === "vapi") {
      return twimlResponse(`<Redirect method="POST">https://api.vapi.ai/twilio/inbound_call</Redirect>`);
    }

    const customer = from !== "anonymous" ? await findCustomerByPhone(from).catch(() => null) : null;
    const { callId, sipUri } = await registerRetellCall({
      fromNumber: from,
      toNumber: to,
      metadata: { twilioCallSid: params.CallSid, customerId: customer?.id ?? null },
      dynamicVariables: {
        caller_number: from,
        customer_status: customer?.status ?? "NEW",
        customer_name: customer?.name ?? "",
        customer_company: customer?.companyName ?? "",
        customer_type: customer?.customerType ?? "PRIVATE",
        customer_postal_code: customer?.postalCode ?? "",
        customer_address: customer?.address ?? "",
      },
    });
    logger.info("retell.registered", { callSid: params.CallSid, callId });
    return twimlResponse(dialSip(sipUri));
  } catch (err) {
    logger.error("twilio.ai_handoff_failed", { error: (err as Error).message });
    return fallbackTwiml(params.To);
  }
}
