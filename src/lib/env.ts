import { z } from "zod";

/** Plattformweite Konfiguration (VPS). Mandanten-spezifisches liegt in der Datenbank. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /** Öffentliche Basis-URL, z. B. https://app.deine-domain.de (für Links, Webhooks, Twilio-Signatur) */
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  /** Einmal-Token für die Ersteinrichtung des Plattform-Admins unter /setup */
  SETUP_TOKEN: z.string().min(16).optional(),
  /** Schutz für /api/cron/* (z. B. Löschfristen) */
  CRON_SECRET: z.string().min(16).optional(),

  // Twilio (Plattform-Konto; Nummern werden Mandanten zugeordnet)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VALIDATE_SIGNATURE: z.enum(["true", "false"]).default("true"),
  /** Absender für SMS (Nummer oder Messaging-Service-SID "MG…") */
  TWILIO_SMS_FROM: z.string().optional(),

  // Retell AI
  RETELL_API_KEY: z.string().optional(),
  /** Standard-Agent (gemeinsamer Prompt mit Mandanten-Variablen); je Nummer überschreibbar */
  RETELL_AGENT_ID: z.string().optional(),
  RETELL_SIP_DOMAIN: z.string().default("sip.retellai.com"),
  /** Zusätzliches Shared Secret für Tool-Calls (Header x-tool-secret) */
  VOICE_TOOL_SECRET: z.string().optional(),

  // Microsoft 365 – EINE mandantenfähige Entra-App der Plattform; Kunden erteilen Admin-Consent
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),

  // E-Mail-Versand (beliebiger SMTP-Anbieter: IONOS, Postmark, Brevo, M365 …)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(), // "KI-Telefonzentrale <noreply@deine-domain.de>"

  PLATFORM_NAME: z.string().default("KI-Telefonzentrale"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
export function resetEnvCache() {
  cached = null;
}

export const microsoftConfigured = () => Boolean(env().MS_CLIENT_ID && env().MS_CLIENT_SECRET);
export const smtpConfigured = () => Boolean(env().SMTP_HOST && env().SMTP_FROM);
export const smsConfigured = () => Boolean(env().TWILIO_ACCOUNT_SID && env().TWILIO_AUTH_TOKEN && env().TWILIO_SMS_FROM);
export const retellConfigured = () => Boolean(env().RETELL_API_KEY && env().RETELL_AGENT_ID);
