import { describe, expect, it } from "vitest";
import { billedMinutes, effectivePlan, hasFeature, invoiceFor } from "@/lib/billing";
import type { Plan } from "@prisma/client";

const plan = {
  id: "p", key: "B", name: "Business", description: "", active: true, monthlyPriceCents: 12900, setupFeeCents: 9900,
  includedMinutes: 100, overageCentsPerMinute: 32, overageMode: "CHARGE", billingIncrementSec: 60, includedSms: 10, smsCents: 12,
  maxNumbers: 2, maxUsers: 10, features: ["sms"], sortOrder: 1, createdAt: new Date(), updatedAt: new Date(),
} as Plan;
const noOverride = { priceOverrideCents: null, includedMinutesOverride: null, overageCentsOverride: null };
const usage = (minutes: number, sms = 0) => ({ calls: 1, seconds: minutes * 60, minutes, sms, emails: 0, tickets: 0, emergencies: 0 });

describe("Abrechnung", () => {
  it("rundet je Gespräch auf den Abrechnungstakt", () => {
    expect(billedMinutes([61, 30], 60)).toBe(3); // 2 + 1 Minuten
    expect(billedMinutes([61, 30], 1)).toBeCloseTo(1.52, 2);
    expect(billedMinutes([61], 30)).toBe(1.5);
  });
  it("berechnet Überminuten und zusätzliche SMS", () => {
    const inv = invoiceFor(effectivePlan(noOverride, plan), usage(130, 15), { includeSetupFee: false });
    expect(inv.overageMinutes).toBe(30);
    expect(inv.overageSms).toBe(5);
    expect(inv.netCents).toBe(12900 + 30 * 32 + 5 * 12);
  });
  it("berechnet im Stopp-Modus keine Überminuten", () => {
    const inv = invoiceFor(effectivePlan(noOverride, { ...plan, overageMode: "BLOCK" }), usage(130), { includeSetupFee: false });
    expect(inv.netCents).toBe(12900);
  });
  it("Einrichtungsgebühr nur im ersten Monat, Sonderpreise je Kunde", () => {
    const eff = effectivePlan({ priceOverrideCents: 9900, includedMinutesOverride: 200, overageCentsOverride: 20 }, plan);
    expect(eff.monthlyPriceCents).toBe(9900);
    const inv = invoiceFor(eff, usage(210), { includeSetupFee: true });
    expect(inv.netCents).toBe(9900 + 9900 + 10 * 20);
  });
  it("ohne Paket: keine Kosten, alle Funktionen", () => {
    const eff = effectivePlan(noOverride, null);
    expect(invoiceFor(eff, usage(500), { includeSetupFee: true }).netCents).toBe(0);
    expect(hasFeature(eff, "calendar_external")).toBe(true);
    expect(hasFeature(effectivePlan(noOverride, plan), "calendar_external")).toBe(false);
  });
});
