import { z } from "zod";
import { PLAN_FEATURES } from "@/lib/platform/registry";

const cents = z.number().int().min(0).max(10_000_000);
export const planSchema = z.object({
  key: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, "Kürzel: 2–30 Zeichen A–Z, 0–9, _"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
  monthlyPriceCents: cents,
  setupFeeCents: cents.default(0),
  includedMinutes: z.number().int().min(0).max(1_000_000),
  overageCentsPerMinute: cents,
  overageMode: z.enum(["CHARGE", "BLOCK"]).default("CHARGE"),
  billingIncrementSec: z.number().int().min(1).max(60).default(60),
  includedSms: z.number().int().min(0).max(1_000_000).default(0),
  smsCents: cents.default(0),
  maxNumbers: z.number().int().min(1).max(1000).nullable().default(null),
  maxUsers: z.number().int().min(1).max(10000).nullable().default(null),
  features: z.array(z.string().refine((f) => PLAN_FEATURES.some((x) => x.key === f))).default([]),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
