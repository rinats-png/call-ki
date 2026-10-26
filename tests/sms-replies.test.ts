import { describe, expect, it } from "vitest";
import { replyIntent } from "@/lib/services/sms-replies";

describe("Antwort auf „Passt es noch?“", () => {
  it.each([
    ["Ja", "YES"], ["ja passt 👍", "YES"], ["OK!", "YES"], ["Passt", "YES"], ["Alles klar, bis morgen", "YES"],
    ["Nein", "NO"], ["nee geht nicht", "NO"], ["Bitte verschieben", "OTHER"], ["verschieben bitte", "NO"], ["Absagen", "NO"],
    ["STOP", "STOP"], ["Stopp", "STOP"], ["Wer ist das?", "OTHER"], ["Japan", "OTHER"],
  ])("%s → %s", (text, intent) => expect(replyIntent(text)).toBe(intent));
});
