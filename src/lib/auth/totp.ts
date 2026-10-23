import crypto from "node:crypto";

/**
 * TOTP nach RFC 6238 (HMAC-SHA1, 30 s, 6 Stellen) – kompatibel mit Google/Microsoft
 * Authenticator, 1Password, Aegis usw. Keine Fremdbibliothek für die Kryptografie.
 */
const STEP = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Ungültiges Base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160 Bit
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const off = h[h.length - 1] & 0xf;
  const code = (h.readUInt32BE(off) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

/**
 * Prüft einen Code mit ±1 Zeitschritt Toleranz. Gibt den genutzten Zeitschritt
 * zurück (für Wiederverwendungsschutz) oder null.
 */
export function verifyTotp(secret: string, code: string, opts: { lastStep?: number | null; now?: number } = {}): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = currentStep(opts.now);
  for (const step of [now, now - 1, now + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const expected = totpAt(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/** 10 Wiederherstellungscodes im Format xxxx-xxxx (≈ 40 Bit je Code). */
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const s = base32Encode(crypto.randomBytes(5)).toLowerCase().slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const normalizeRecoveryCode = (c: string) => c.toLowerCase().replace(/[^a-z2-7]/g, "");
