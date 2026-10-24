import { env } from "../env";

/** Öffentliche Webhook-URLs, die bei den Anbietern einzutragen sind. */
export function webhookUrls(): Record<string, string> {
  const base = env().PUBLIC_BASE_URL.replace(/\/$/, "");
  return {
    twilioVoice: `${base}/api/twilio/voice`,
    twilioStatus: `${base}/api/twilio/status`,
    twilioFallback: `${base}/api/twilio/fallback`,
    retellTools: `${base}/api/voice/tools/{name}`,
    retellEvents: `${base}/api/voice/events`,
    vapiServer: `${base}/api/voice/vapi`,
    elevenlabsEvents: `${base}/api/voice/events/elevenlabs`,
    genericTools: `${base}/api/voice/tools/{name}`,
    microsoftRedirect: `${base}/api/integrations/microsoft/callback`,
    googleRedirect: `${base}/api/integrations/google/callback`,
  };
}
