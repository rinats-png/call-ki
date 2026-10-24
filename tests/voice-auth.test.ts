import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyVoiceRequest, voiceAuthAllows } from "@/lib/security";
import { resetEnvCache } from "@/lib/env";
import { isCallActive } from "@/lib/voice/context";
import { CUSTOMER_TYPES } from "@/lib/constants";

const KEYS = ["VOICE_TOOL_SECRET", "VOICE_TOOL_SECRET_RETELL", "VOICE_TOOL_SECRET_VAPI", "VOICE_TOOL_SECRET_ELEVENLABS", "VOICE_TOOL_SECRET_SIP", "RETELL_API_KEY"];
const setEnv = (vars: Record<string, string>) => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  resetEnvCache();
};
const req = (headers: Record<string, string>) => new Request("https://x.de/api/voice/tools", { method: "POST", headers });

describe("Webhook-Geheimnis je Anbieter", () => {
  afterEach(() => setEnv({}));

  it("erkennt den Anbieter am eigenen Geheimnis", () => {
    setEnv({ VOICE_TOOL_SECRET_RETELL: "r".repeat(32), VOICE_TOOL_SECRET_VAPI: "v".repeat(32), VOICE_TOOL_SECRET_ELEVENLABS: "e".repeat(32), VOICE_TOOL_SECRET_SIP: "s".repeat(32) });
    expect(verifyVoiceRequest(req({ "x-tool-secret": "r".repeat(32) }), "{}")).toBe("retell");
    expect(verifyVoiceRequest(req({ "x-vapi-secret": "v".repeat(32) }), "{}")).toBe("vapi");
    expect(verifyVoiceRequest(req({ authorization: `Bearer ${"e".repeat(32)}` }), "{}")).toBe("elevenlabs");
    expect(verifyVoiceRequest(req({ "x-tool-secret": "s".repeat(32) }), "{}")).toBe("sip");
    expect(verifyVoiceRequest(req({ "x-tool-secret": "falsch" }), "{}")).toBeNull();
    expect(verifyVoiceRequest(req({}), "{}")).toBeNull();
  });

  it("nimmt das gemeinsame Geheimnis nur, solange kein Anbieter-Geheimnis gesetzt ist", () => {
    setEnv({ VOICE_TOOL_SECRET: "g".repeat(32) });
    expect(verifyVoiceRequest(req({ "x-tool-secret": "g".repeat(32) }), "{}")).toBe("shared");
    setEnv({ VOICE_TOOL_SECRET: "g".repeat(32), VOICE_TOOL_SECRET_VAPI: "v".repeat(32) });
    expect(verifyVoiceRequest(req({ "x-tool-secret": "g".repeat(32) }), "{}")).toBeNull();
  });

  it("akzeptiert die Retell-Signatur als Retell", () => {
    setEnv({ RETELL_API_KEY: "key_abc", VOICE_TOOL_SECRET_SIP: "s".repeat(32) });
    const ts = String(Date.now());
    const d = crypto.createHmac("sha256", "key_abc").update("{}" + ts).digest("hex");
    expect(verifyVoiceRequest(req({ "x-retell-signature": `v=${ts},d=${d}` }), "{}")).toBe("retell");
  });

  it("ist ohne Geheimnis nur außerhalb der Produktion offen", () => {
    setEnv({});
    expect(verifyVoiceRequest(req({}), "{}")).toBe("dev"); // Tests laufen nicht als production
  });

  it("erlaubt jedem Anbieter nur sein eigenes Format", () => {
    expect(voiceAuthAllows("retell", "retell")).toBe(true);
    expect(voiceAuthAllows("retell", "vapi")).toBe(false);
    expect(voiceAuthAllows("vapi", "generic")).toBe(false);
    expect(voiceAuthAllows("elevenlabs", "generic")).toBe(true);
    expect(voiceAuthAllows("sip", "generic")).toBe(true);
    expect(voiceAuthAllows("sip", "retell")).toBe(false);
    expect(voiceAuthAllows("shared", "vapi")).toBe(true);
  });
});

describe("Laufender Anruf", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  it("gilt bis kurz nach dem Auflegen und höchstens 3 Stunden", () => {
    expect(isCallActive({ startedAt: new Date(now - 60_000), endedAt: null }, now)).toBe(true);
    expect(isCallActive({ startedAt: new Date(now - 10 * 60_000), endedAt: new Date(now - 60_000) }, now)).toBe(true);
    expect(isCallActive({ startedAt: new Date(now - 10 * 60_000), endedAt: new Date(now - 5 * 60_000) }, now)).toBe(false);
    expect(isCallActive({ startedAt: new Date(now - 4 * 3600_000), endedAt: null }, now)).toBe(false);
  });
});

describe("voice-agent/tools.json", () => {
  it("nutzt genau die Kundentypen, die der Server kennt", () => {
    const tools = JSON.parse(fs.readFileSync(path.join(__dirname, "../voice-agent/tools.json"), "utf8")).tools as { name: string; parameters: { properties: Record<string, { enum?: string[] }> } }[];
    const enums = tools.map((t) => t.parameters.properties.customerType?.enum).filter(Boolean);
    expect(enums.length).toBeGreaterThan(0);
    for (const e of enums) expect([...e!].sort()).toEqual([...CUSTOMER_TYPES].sort());
  });
  it("identify_caller nimmt keine Rufnummer von der KI an", () => {
    const tools = JSON.parse(fs.readFileSync(path.join(__dirname, "../voice-agent/tools.json"), "utf8")).tools as { name: string; parameters: { properties: Record<string, unknown> } }[];
    expect(Object.keys(tools.find((t) => t.name === "identify_caller")!.parameters.properties)).not.toContain("phone");
  });
});
