import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { computeTwilioSignature, validateTwilioRequest, verifyRetellSignature } from "@/lib/security";
import { resetEnvCache } from "@/lib/env";

describe("Twilio-Signatur", () => {
  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    resetEnvCache();
  });

  // Referenzbeispiel aus der Twilio-Dokumentation
  it("entspricht dem dokumentierten Beispiel", () => {
    const sig = computeTwilioSignature("12345", "https://mycompany.com/myapp.php?foo=1&bar=2", {
      CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212",
    });
    expect(sig).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  });

  it("validiert Requests mit gesetztem Token", () => {
    process.env.TWILIO_AUTH_TOKEN = "secret";
    resetEnvCache();
    const params = { From: "+491511", To: "+4930" };
    const sig = computeTwilioSignature("secret", "https://x.de/api/twilio/voice", params);
    expect(validateTwilioRequest(sig, "https://x.de/api/twilio/voice", params)).toBe(true);
    expect(validateTwilioRequest(sig, "https://x.de/api/twilio/other", params)).toBe(false);
    expect(validateTwilioRequest(null, "https://x.de/api/twilio/voice", params)).toBe(false);
  });

  it("lässt sich nur außerhalb der Produktion abschalten", () => {
    const old = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { TWILIO_AUTH_TOKEN: "secret", TWILIO_VALIDATE_SIGNATURE: "false", NODE_ENV: "development" });
      resetEnvCache();
      expect(validateTwilioRequest(null, "https://x.de/api/twilio/voice", {})).toBe(true);
      Object.assign(process.env, { NODE_ENV: "production" });
      resetEnvCache();
      expect(validateTwilioRequest(null, "https://x.de/api/twilio/voice", {})).toBe(false);
    } finally {
      Object.assign(process.env, { NODE_ENV: old });
      delete process.env.TWILIO_VALIDATE_SIGNATURE;
      resetEnvCache();
    }
  });
});

describe("Retell-Signatur", () => {
  it("prüft v=timestamp,d=digest", () => {
    const body = '{"event":"call_analyzed"}';
    const ts = String(Date.now());
    const d = crypto.createHmac("sha256", "key").update(body + ts).digest("hex");
    expect(verifyRetellSignature(body, "key", `v=${ts},d=${d}`)).toBe(true);
    expect(verifyRetellSignature(body, "other", `v=${ts},d=${d}`)).toBe(false);
    expect(verifyRetellSignature(body, "key", `v=${Number(ts) - 10 * 60_000},d=${d}`)).toBe(false);
  });
});
