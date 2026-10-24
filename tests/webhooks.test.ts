import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkWebhookUrl, isPrivateAddress, signWebhook } from "@/lib/services/webhooks";

describe("Webhooks: SSRF-Schutz und Signatur", () => {
  it("erkennt interne Adressen", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2a00:1450:4001::1"]) expect(isPrivateAddress(ip)).toBe(false);
  });

  it("lässt nur https zu öffentlichen Zielen zu – auch wenn ein Name intern auflöst", async () => {
    const pub = async () => ["93.184.216.34"];
    await expect(checkWebhookUrl("https://hooks.example.com/x", pub)).resolves.toBeInstanceOf(URL);
    await expect(checkWebhookUrl("http://hooks.example.com/x", pub)).rejects.toThrow(/https/);
    await expect(checkWebhookUrl("https://user:pw@hooks.example.com/x", pub)).rejects.toThrow(/Zugangsdaten/);
    await expect(checkWebhookUrl("https://localhost/x", pub)).rejects.toThrow(/Interne/);
    await expect(checkWebhookUrl("https://169.254.169.254/latest", pub)).rejects.toThrow(/Interne/);
    await expect(checkWebhookUrl("https://rebind.example.com/x", async () => ["93.184.216.34", "10.0.0.5"])).rejects.toThrow(/Interne/);
  });

  it("signiert Zeitstempel und Inhalt mit HMAC-SHA256", () => {
    const sig = signWebhook("whsec_test", 1700000000, '{"a":1}');
    const expected = crypto.createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
    expect(sig).toBe(`t=1700000000,v1=${expected}`);
  });
});
