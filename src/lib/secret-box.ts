import crypto from "node:crypto";
import { logger } from "./logger";

/**
 * Verschlüsselung kleiner Geheimnisse in der Datenbank (z. B. TOTP-Secrets) mit
 * AES-256-GCM. Schlüssel: APP_ENCRYPTION_KEY (32 Byte, hex oder base64).
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url)
 */
let warned = false;
function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) {
    const k = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY muss 32 Byte lang sein (openssl rand -hex 32)");
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("APP_ENCRYPTION_KEY ist nicht gesetzt");
  if (!warned) {
    logger.warn("secret_box.dev_key", { hint: "APP_ENCRYPTION_KEY fehlt – Entwicklungsschlüssel aktiv" });
    warned = true;
  }
  return crypto.createHash("sha256").update("dev-only-key-do-not-use-in-production").digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Ungültiges Format");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
