import { z } from "zod";

/** Zentral validierte Server-Konfiguration. Optionale Integrationen schalten sich bei fehlenden Werten ab. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_BASE_URL: z.string().url().optional(),

  // Dashboard-Zugang (HTTP Basic Auth)
  DASHBOARD_USER: z.string().default("admin"),
  DASHBOARD_PASSWORD: z.string().optional(),

  // Twilio
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VALIDATE_SIGNATURE: z.enum(["true", "false"]).default("true"),
  BACKOFFICE_FALLBACK_NUMBER: z.string().optional(),

  // Voice AI
  VOICE_PROVIDER: z.enum(["retell", "vapi"]).default("retell"),
  VOICE_TOOL_SECRET: z.string().optional(),
  RETELL_API_KEY: z.string().optional(),
  RETELL_AGENT_ID: z.string().optional(),
  RETELL_SIP_DOMAIN: z.string().default("5t4n6j0wnrl.sip.livekit.cloud"),

  // Microsoft Graph (App-Only / Client Credentials)
  MS_TENANT_ID: z.string().optional(),
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  MS_DRAFT_MAILBOX: z.string().optional(), // Postfach, in dem Kunden-E-Mail-Entwürfe landen (z. B. info@storm.gmbh)

  // Terminlogik
  BUSINESS_TIMEZONE: z.string().default("Europe/Berlin"),
  BUSINESS_HOURS_START: z.coerce.number().int().min(0).max(23).default(8),
  BUSINESS_HOURS_END: z.coerce.number().int().min(1).max(24).default(18),
  APPOINTMENT_DURATION_MIN: z.coerce.number().int().min(15).max(480).default(60),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function graphConfigured(): boolean {
  const e = env();
  return Boolean(e.MS_TENANT_ID && e.MS_CLIENT_ID && e.MS_CLIENT_SECRET);
}

/** Nur für Tests. */
export function resetEnvCache() {
  cached = null;
}
