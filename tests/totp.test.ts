import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, totpAt, verifyTotp } from "@/lib/auth/totp";
import { open, seal } from "@/lib/secret-box";

// Testvektor aus RFC 6238 Anhang B (SHA1, Secret "12345678901234567890")
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("entspricht den RFC-Testvektoren (6 Stellen)", () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("Base32 ist umkehrbar", () => {
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
  });
  it("akzeptiert ±1 Zeitschritt und verhindert Wiederverwendung", () => {
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    const code = totpAt(RFC_SECRET, step - 1);
    expect(verifyTotp(RFC_SECRET, code, { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, code, { now, lastStep: step - 1 })).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 3), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12ab56", { now })).toBeNull();
  });
  it("erzeugt eindeutige Wiederherstellungscodes", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/);
  });
});

describe("Secret-Box (AES-256-GCM)", () => {
  it("verschlüsselt und erkennt Manipulation", () => {
    const s = seal("geheim");
    expect(s).not.toContain("geheim");
    expect(open(s)).toBe("geheim");
    const parts = s.split(".");
    parts[3] = Buffer.from("x").toString("base64url");
    expect(() => open(parts.join("."))).toThrow();
  });
});
