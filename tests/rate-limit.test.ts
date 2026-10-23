import { describe, expect, it } from "vitest";
import { hit } from "@/lib/rate-limit";

describe("Rate-Limiter", () => {
  it("lässt bis zum Limit zu und nennt danach die Wartezeit", () => {
    const l = { limit: 3, windowMs: 60_000 };
    const t = 1_000_000;
    expect(hit("k1", l, t)).toBe(0);
    expect(hit("k1", l, t + 1)).toBe(0);
    expect(hit("k1", l, t + 2)).toBe(0);
    expect(hit("k1", l, t + 3)).toBe(60);
    // Fenster gleitet: nach Ablauf des ersten Treffers wieder frei
    expect(hit("k1", l, t + 60_001)).toBe(0);
  });
  it("trennt Schlüssel", () => {
    const l = { limit: 1, windowMs: 1000 };
    expect(hit("a", l, 5)).toBe(0);
    expect(hit("b", l, 5)).toBe(0);
    expect(hit("a", l, 6)).toBeGreaterThan(0);
  });
});

import { recordingUrlAllowed } from "@/lib/voice/providers";

describe("Aufnahme-URLs (SSRF-Schutz)", () => {
  it("erlaubt nur HTTPS-Hosts der Anbieter", () => {
    expect(recordingUrlAllowed("https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1")).toBe(true);
    expect(recordingUrlAllowed("https://dxc03zgurdly9.cloudfront.net/abc/recording.wav")).toBe(true);
    expect(recordingUrlAllowed("http://api.twilio.com/x")).toBe(false);
    expect(recordingUrlAllowed("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(recordingUrlAllowed("https://evil-twilio.com/x")).toBe(false);
    expect(recordingUrlAllowed("https://localhost/x")).toBe(false);
  });
});
