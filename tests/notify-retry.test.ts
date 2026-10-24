import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, nextAttemptAfter } from "@/lib/notify";

describe("Wiederholung fehlgeschlagener Nachrichten", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const minutes = (d: Date | null) => (d ? (d.getTime() - now) / 60_000 : null);

  it("wartet bei Notfall-Alarmen kürzer", () => {
    expect(minutes(nextAttemptAfter(1, "EMERGENCY_ALERT", now))).toBe(1);
    expect(minutes(nextAttemptAfter(1, "CUSTOMER_CONFIRMATION", now))).toBe(2);
    expect(minutes(nextAttemptAfter(4, "CUSTOMER_CONFIRMATION", now))).toBe(120);
  });

  it("gibt nach der Höchstzahl an Versuchen auf", () => {
    expect(nextAttemptAfter(MAX_ATTEMPTS - 1, "EMERGENCY_ALERT", now)).not.toBeNull();
    expect(nextAttemptAfter(MAX_ATTEMPTS, "EMERGENCY_ALERT", now)).toBeNull();
  });
});
