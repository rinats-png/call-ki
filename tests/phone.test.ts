import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["+49 151 1234 5678", "+4915112345678"],
    ["0151/12345678", "+4915112345678"],
    ["0049 40 123456", "+4940123456"],
    ["(040) 123-456", "+4940123456"],
    ["+43 1 234567", "+431234567"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));

  it("verwirft ungültige Eingaben", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
