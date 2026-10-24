import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecording } from "@/lib/voice/providers";
import { resetEnvCache } from "@/lib/env";

// T-SEC-10: Aufnahme-Abruf folgt Weiterleitungen nur auf erlaubte Hosts, Zugangsdaten nur an Twilio
describe("fetchRecording", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    resetEnvCache();
  });

  const stub = (routes: Record<string, Response>) => {
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return routes[url] ?? new Response("nicht gefunden", { status: 404 });
    }));
    return calls;
  };

  it("bricht bei Weiterleitung auf einen fremden Host ab", async () => {
    stub({ "https://api.retellai.com/rec.wav": new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }) });
    await expect(fetchRecording("https://api.retellai.com/rec.wav")).rejects.toThrow("nicht erlaubten Host");
  });

  it("folgt Twilio → S3 und schickt die Zugangsdaten nur an Twilio", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC" + "0".repeat(32);
    process.env.TWILIO_AUTH_TOKEN = "token";
    resetEnvCache();
    const calls = stub({
      "https://api.twilio.com/2010-04-01/Accounts/AC/Recordings/RE1.mp3": new Response(null, { status: 307, headers: { location: "https://bucket.s3.amazonaws.com/RE1.mp3" } }),
      "https://bucket.s3.amazonaws.com/RE1.mp3": new Response("audio", { status: 200 }),
    });
    const res = await fetchRecording("https://api.twilio.com/2010-04-01/Accounts/AC/Recordings/RE1");
    expect(await res.text()).toBe("audio");
    expect(calls[0].auth).toBeTruthy();
    expect(calls[1].auth).toBeNull();
  });
});
