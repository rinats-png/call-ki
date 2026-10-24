import { describe, expect, it } from "vitest";
import { twilioBinTwiml } from "@/lib/voice/twilio-fallback";

describe("Ersatzziel bei Twilio", () => {
  it("leitet auf die Fallback-Nummer weiter, ohne unseren Server aufzurufen", () => {
    const x = twilioBinTwiml({ e164: "+4930111", fallbackNumber: "+4915112345" }, "Müller & Söhne <GmbH>");
    expect(x).toContain('<Dial timeout="30" callerId="+4930111">+4915112345</Dial>');
    expect(x).toContain("Müller &amp; Söhne &lt;GmbH&gt;");
    expect(x).not.toMatch(/https?:\/\//); // keine Abhängigkeit von irgendeiner URL
    expect(x.trim().endsWith("<Hangup/></Response>")).toBe(true);
  });

  it("sagt ohne Fallback-Nummer eine Störung an und legt auf", () => {
    const x = twilioBinTwiml({ e164: "+4930111", fallbackNumber: null }, "Firma");
    expect(x).not.toContain("<Dial");
    expect(x).toContain("technisch nicht erreichbar");
  });
});

import { dialSip } from "@/lib/twiml";
describe("Höchstdauer", () => {
  it("setzt timeLimit an der SIP-Weiterleitung", () => {
    expect(dialSip("sip:a@b", 1200)).toBe('<Dial timeLimit="1200"><Sip>sip:a@b</Sip></Dial>');
    expect(dialSip("sip:a@b")).toBe("<Dial><Sip>sip:a@b</Sip></Dial>");
  });
});
