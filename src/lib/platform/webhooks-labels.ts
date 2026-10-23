/** Beschriftung der Webhook-URLs (auch im Browser nutzbar). */
export const WEBHOOK_LABEL: Record<string, string> = {
  twilioVoice: "Twilio-Voice-URL („A call comes in“, POST)",
  twilioFallback: "Twilio-Fallback-URL („Primary handler fails“)",
  retellTools: "Retell-Tool-URL (je Funktion, {name} ersetzen)",
  retellEvents: "Retell-Ereignis-URL (Agent → Webhook URL)",
  vapiServer: "Vapi-Server-URL (Assistent → Server URL)",
  elevenlabsEvents: "ElevenLabs-Ereignis-URL (Post-call webhook)",
  genericTools: "Generische Tool-URL (je Funktion, {name} ersetzen)",
  microsoftRedirect: "Microsoft-Redirect-URL (Entra-App → Umleitungs-URI)",
  googleRedirect: "Google-Redirect-URL (OAuth-Client → Weiterleitungs-URI)",
};
