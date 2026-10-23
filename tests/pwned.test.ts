import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkNewPassword, isPwned } from "@/lib/auth/pwned";

const suffixOf = (pw: string) => crypto.createHash("sha1").update(pw).digest("hex").toUpperCase().slice(5);

describe("Leak-Prüfung (HIBP, k-Anonymität)", () => {
  beforeEach(() => {
    process.env.PWNED_CHECK = "true";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.PWNED_CHECK = "false";
  });

  it("sendet nur das 5-stellige Präfix und erkennt Treffer", async () => {
    const pw = "passwort123456";
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response(`0000000000000000000000000000000000A:0\r\n${suffixOf(pw)}:4211\r\n`));
    vi.stubGlobal("fetch", fetchMock);
    expect(await isPwned(pw)).toBe(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/range\/[0-9A-F]{5}$/);
    expect(url).not.toContain(suffixOf(pw));
  });

  it("ignoriert Padding-Einträge mit Zähler 0", async () => {
    const pw = "ein sehr langes eigenes passwort";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`${suffixOf(pw)}:0\r\n`)));
    expect(await isPwned(pw)).toBe(false);
  });

  it("blockiert nicht, wenn der Dienst ausfällt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await isPwned("irgendein passwort")).toBeNull();
    expect(await checkNewPassword("irgendein passwort")).toBeNull();
    expect(await checkNewPassword("zu kurz")).toMatch(/12 Zeichen/);
  });
});
