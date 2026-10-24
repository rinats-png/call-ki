import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { currentKeyId, needsReseal, open, seal } from "@/lib/secret-box";

const A = "a".repeat(64);
const B = "b".repeat(64);
const set = (cur?: string, old?: string) => {
  if (cur) process.env.APP_ENCRYPTION_KEY = cur;
  else delete process.env.APP_ENCRYPTION_KEY;
  if (old) process.env.APP_ENCRYPTION_KEYS_OLD = old;
  else delete process.env.APP_ENCRYPTION_KEYS_OLD;
};

describe("Verschlüsselung mit Schlüsselwechsel", () => {
  afterEach(() => set());

  it("verschlüsselt mit Schlüssel-ID und entschlüsselt wieder", () => {
    set(A);
    const s = seal("geheim");
    expect(s.startsWith(`v2.${currentKeyId()}.`)).toBe(true);
    expect(open(s)).toBe("geheim");
    expect(needsReseal(s)).toBe(false);
  });

  it("liest nach dem Wechsel mit dem alten Schlüssel und markiert zum Umschlüsseln", () => {
    set(A);
    const s = seal("totp-secret");
    set(B, A);
    expect(open(s)).toBe("totp-secret");
    expect(needsReseal(s)).toBe(true);
    const neu = seal(open(s));
    expect(needsReseal(neu)).toBe(false);
    set(B); // alter Schlüssel entfernt
    expect(() => open(s)).toThrow(/APP_ENCRYPTION_KEYS_OLD/);
    expect(open(neu)).toBe("totp-secret");
  });

  it("liest das alte Format v1 (ohne Schlüssel-ID)", () => {
    const key = Buffer.from(A, "hex");
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update("alt", "utf8"), c.final()]);
    const v1 = ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
    set(B, A);
    expect(open(v1)).toBe("alt");
    expect(needsReseal(v1)).toBe(true);
  });
});
