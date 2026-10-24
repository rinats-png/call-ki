import crypto from "node:crypto";
import { logger } from "./logger";

/**
 * Verschlüsselung kleiner Geheimnisse in der Datenbank (TOTP-Secrets, in der Oberfläche
 * gespeicherte Anbieter-Schlüssel, Google-Refresh-Tokens) mit AES-256-GCM.
 *
 * Schlüssel: APP_ENCRYPTION_KEY (aktuell, 32 Byte hex/base64) und optional
 * APP_ENCRYPTION_KEYS_OLD (frühere Schlüssel, kommagetrennt) – nur zum Entschlüsseln.
 * Format: v2.<schlüssel-id>.<iv>.<tag>.<ciphertext> (base64url); das alte Format
 * v1.<iv>.<tag>.<ciphertext> wird weiter gelesen. Rotation: docs/betrieb.md → „Schlüsselwechsel“.
 */
type Key = { id: string; key: Buffer };

let warned = false;
function parseKey(raw: string): Key {
  const k = /^[0-9a-f]{64}$/i.test(raw.trim()) ? Buffer.from(raw.trim(), "hex") : Buffer.from(raw.trim(), "base64");
  if (k.length !== 32) throw new Error("APP_ENCRYPTION_KEY muss 32 Byte lang sein (openssl rand -hex 32)");
  return { id: crypto.createHash("sha256").update(k).digest("hex").slice(0, 8), key: k };
}

function currentKey(): Key {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) return parseKey(raw);
  if (process.env.NODE_ENV === "production") throw new Error("APP_ENCRYPTION_KEY ist nicht gesetzt");
  if (!warned) {
    logger.warn("secret_box.dev_key", { hint: "APP_ENCRYPTION_KEY fehlt – Entwicklungsschlüssel aktiv" });
    warned = true;
  }
  return parseKey(crypto.createHash("sha256").update("dev-only-key-do-not-use-in-production").digest("hex"));
}

/** Aktueller Schlüssel zuerst, dann die alten. */
function allKeys(): Key[] {
  const old = (process.env.APP_ENCRYPTION_KEYS_OLD ?? "").split(",").map((s) => s.trim()).filter(Boolean).map(parseKey);
  return [currentKey(), ...old];
}

/** Kennung des aktuellen Schlüssels (zum Prüfen, ob ein Wert umgeschlüsselt werden muss). */
export function currentKeyId(): string {
  return currentKey().id;
}

export function seal(plain: string): string {
  const k = currentKey();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k.key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v2", k.id, iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

function decrypt(key: Buffer, iv: string, tag: string, ct: string): string {
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export function open(sealed: string): string {
  const parts = sealed.split(".");
  if (parts[0] === "v2" && parts.length === 5) {
    const [, kid, iv, tag, ct] = parts;
    const k = allKeys().find((x) => x.id === kid);
    if (!k) throw new Error(`Schlüssel ${kid} nicht vorhanden (APP_ENCRYPTION_KEYS_OLD prüfen)`);
    return decrypt(k.key, iv, tag, ct);
  }
  if (parts[0] === "v1" && parts.length === 4) {
    const [, iv, tag, ct] = parts;
    for (const k of allKeys()) {
      try {
        return decrypt(k.key, iv, tag, ct);
      } catch {
        /* nächsten Schlüssel versuchen */
      }
    }
    throw new Error("Entschlüsselung fehlgeschlagen (kein passender Schlüssel)");
  }
  throw new Error("Ungültiges Format");
}

/** Muss dieser Wert mit dem aktuellen Schlüssel neu verschlüsselt werden? */
export function needsReseal(sealed: string): boolean {
  const parts = sealed.split(".");
  return !(parts[0] === "v2" && parts[1] === currentKeyId());
}
