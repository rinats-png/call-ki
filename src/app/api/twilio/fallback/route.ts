import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { fallbackTwiml } from "@/lib/voice/fallback";
import { tenantForCalledNumber, twilioParams } from "@/lib/voice/inbound";

export const dynamic = "force-dynamic";

/** Twilio "Primary handler fails" – greift, wenn unsere App selbst nicht antwortet. */
export async function POST(req: Request) {
  const params = await twilioParams(req);
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) return new Response("Forbidden", { status: 403 });
  const number = await tenantForCalledNumber(params.To).catch(() => null);
  return fallbackTwiml({ companyName: number?.tenant.name, fallbackNumber: number?.fallbackNumber, callerId: params.To });
}
