import crypto from "node:crypto";
import { env } from "./env";

/** Konstantzeit-Vergleich zweier Strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Twilio Request Validation (X-Twilio-Signature).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function validateTwilioRequest(signature: string | null, url: string, params: Record<string, string>): boolean {
  const e = env();
  if (e.TWILIO_VALIDATE_SIGNATURE === "false") return true;
  if (!e.TWILIO_AUTH_TOKEN || !signature) return false;
  return safeEqual(computeTwilioSignature(e.TWILIO_AUTH_TOKEN, url, params), signature);
}

/** Rekonstruiert die öffentliche URL (Twilio signiert die URL, die es aufgerufen hat). */
export function publicUrl(req: Request): string {
  const u = new URL(req.url);
  const base = env().PUBLIC_BASE_URL;
  if (base) return base.replace(/\/$/, "") + u.pathname + u.search;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}${u.pathname}${u.search}`;
}

/** Wer eine Voice-Anfrage nachweislich geschickt hat. "shared"/"dev" = ohne Anbieterbindung. */
export type VoiceAuth = "retell" | "vapi" | "elevenlabs" | "sip" | "shared" | "dev";

/** Eigenes Geheimnis je Anbieter: ein Leck bei einem Anbieter öffnet nicht die Schnittstellen der anderen. */
export const VOICE_SECRET_KEYS = {
  retell: "VOICE_TOOL_SECRET_RETELL",
  vapi: "VOICE_TOOL_SECRET_VAPI",
  elevenlabs: "VOICE_TOOL_SECRET_ELEVENLABS",
  sip: "VOICE_TOOL_SECRET_SIP",
} as const;

/**
 * Authentifizierung der Voice-AI-Webhooks (Tool Calls & Call Events).
 * Akzeptiert:
 *  - Retell: Header `x-retell-signature` (HMAC-SHA256 über Body, Schlüssel = RETELL_API_KEY)
 *  - Geheimnis des Anbieters (VOICE_TOOL_SECRET_RETELL/_VAPI/_ELEVENLABS/_SIP) als
 *    `x-tool-secret`, `x-vapi-secret` oder `Authorization: Bearer …`
 *  - Übergang: gemeinsames VOICE_TOOL_SECRET – nur solange kein Anbieter-Geheimnis gesetzt ist
 * Gibt zurück, welcher Anbieter sich ausgewiesen hat (null = abgelehnt).
 */
export function verifyVoiceRequest(req: Request, rawBody: string): VoiceAuth | null {
  const e = env();
  const provided =
    req.headers.get("x-vapi-secret") ??
    req.headers.get("x-tool-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  const own = Object.entries(VOICE_SECRET_KEYS) as [Exclude<VoiceAuth, "shared" | "dev">, keyof typeof e][];
  if (provided) {
    for (const [who, key] of own) {
      const secret = e[key];
      if (typeof secret === "string" && secret && safeEqual(provided, secret)) return who;
    }
  }
  const anyOwn = own.some(([, key]) => !!e[key]);
  if (!anyOwn && e.VOICE_TOOL_SECRET && provided && safeEqual(provided, e.VOICE_TOOL_SECRET)) return "shared";

  const retellSig = req.headers.get("x-retell-signature");
  if (retellSig && e.RETELL_API_KEY && verifyRetellSignature(rawBody, e.RETELL_API_KEY, retellSig)) return "retell";

  // Ohne konfiguriertes Secret nur in der Entwicklung offen
  if (!anyOwn && !e.VOICE_TOOL_SECRET && !e.RETELL_API_KEY) return e.NODE_ENV !== "production" ? "dev" : null;
  return null;
}

/** Darf ein so ausgewiesener Absender Anfragen im Format dieses Anbieters schicken? */
export function voiceAuthAllows(auth: VoiceAuth, provider: "retell" | "vapi" | "generic"): boolean {
  if (auth === "shared" || auth === "dev") return true;
  if (provider === "generic") return auth === "elevenlabs" || auth === "sip";
  return auth === provider;
}

/**
 * Retell Signatur: "v=<timestamp>,d=<hex hmac-sha256(body + timestamp)>".
 * Ältere Variante: reiner Hex-HMAC über den Body. Beide werden akzeptiert.
 */
export function verifyRetellSignature(body: string, apiKey: string, signature: string, now = Date.now()): boolean {
  const m = signature.match(/v=(\d+),d=([a-f0-9]+)/i);
  if (m) {
    const ts = Number(m[1]);
    if (Math.abs(now - ts) > 5 * 60 * 1000) return false;
    const digest = crypto.createHmac("sha256", apiKey).update(body + m[1]).digest("hex");
    return safeEqual(digest, m[2]);
  }
  const digest = crypto.createHmac("sha256", apiKey).update(body).digest("hex");
  return safeEqual(digest, signature);
}

/**
 * ElevenLabs Post-Call-Webhook: Kopfzeile "ElevenLabs-Signature: t=<unix>,v0=<hex>",
 * v0 = HMAC-SHA256("<t>.<rawBody>", Webhook-Secret). Älter als 30 Minuten → abgelehnt.
 */
export function verifyElevenLabsSignature(rawBody: string, header: string | null, secret: string | undefined, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const t = header.match(/(?:^|,)\s*t=(\d+)/)?.[1];
  const v0 = header.match(/(?:^|,)\s*v0=([a-f0-9]+)/i)?.[1];
  if (!t || !v0) return false;
  if (Math.abs(nowSec - Number(t)) > 30 * 60) return false;
  const digest = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return safeEqual(digest, v0.toLowerCase());
}
