import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { fallbackTwiml } from "@/lib/voice/fallback";

export const dynamic = "force-dynamic";

/** Twilio "Primary handler fails" URL – leitet direkt ins Büro bzw. auf die Mailbox. */
export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    return new Response("Forbidden", { status: 403 });
  }
  return fallbackTwiml(params.To);
}
