import type { Customer, Tenant } from "@prisma/client";
import { prisma } from "../db";
import { normalizePhone } from "../phone";
import { fromZoned, zonedParts } from "../time";
import { resolveConfig, type TenantConfig } from "../tenant/settings";
import type { CustomerType } from "../constants";

const DAY = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/**
 * Dynamic Variables für den gemeinsamen Retell-Agenten. Ein Prompt-Template
 * (voice-agent/system-prompt.md) bedient so alle Mandanten.
 */
export function buildDynamicVariables(tenant: Tenant, cfg: TenantConfig, caller: { number: string; customer: Customer | null }): Record<string, string> {
  const s = cfg.settings;
  const t = cfg.template;
  const c = caller.customer;
  const now = new Date();
  const bh = s.businessHours;
  return {
    company_name: tenant.name,
    assistant_name: s.assistantName,
    greeting:
      s.greeting ||
      `${tenant.name}, guten Tag! Hier spricht ${s.assistantName}, die digitale Assistentin.${s.announceRecording ? " Das Gespräch wird zur Bearbeitung Ihres Anliegens aufgezeichnet." : ""} Wie kann ich Ihnen helfen?`,
    company_description: s.companyDescription || t.description,
    industry_context: t.promptContext,
    intake_questions: t.intakeQuestions.join(" "),
    categories: cfg.categories.join(", "),
    safety_rules: t.safetyRules.join(" ") || "–",
    service_area: s.serviceArea || "–",
    faq: s.faq || "–",
    pricing_policy: s.pricingPolicy,
    extra_instructions: s.extraInstructions || "–",
    business_hours: `${bh.days.map((d) => DAY[d]).join(", ")} ${bh.start}–${bh.end} Uhr`,
    emergency_enabled: s.emergency.enabled ? "ja" : "nein",
    current_datetime: new Intl.DateTimeFormat("de-DE", { timeZone: tenant.timezone, dateStyle: "full", timeStyle: "short" }).format(now),
    caller_number: caller.number,
    customer_status: c?.status ?? "NEW",
    customer_name: c?.name ?? "",
    customer_company: c?.companyName ?? "",
    customer_type: c ? (t.customerTypeLabels[c.customerType as CustomerType] ?? c.customerType) : "",
    customer_address: c?.address ?? "",
    customer_postal_code: c?.postalCode ?? "",
  };
}

/** Anrufminuten des laufenden Monats (Mandanten-Zeitzone) – Grundlage für Kontingent & Abrechnung. */
export async function minutesThisMonth(tenant: Pick<Tenant, "id" | "timezone">): Promise<number> {
  const p = zonedParts(new Date(), tenant.timezone);
  const start = fromZoned(p.year, p.month, 1, 0, 0, tenant.timezone);
  const agg = await prisma.call.aggregate({ where: { tenantId: tenant.id, startedAt: { gte: start } }, _sum: { durationSec: true } });
  return Math.ceil((agg._sum.durationSec ?? 0) / 60);
}

export type VoiceCallContext = {
  tenant: Tenant;
  cfg: TenantConfig;
  callRowId: string | null;
  callerNumber: string | null;
};

/**
 * Ermittelt den Mandanten eines laufenden KI-Gesprächs. Vertrauensquelle ist
 * ausschließlich unsere eigene Call-Tabelle (beim Twilio-Eingang angelegt) bzw.
 * die angerufene Nummer – niemals ein Parameter, den die KI selbst setzt.
 */
export async function resolveVoiceContext(providerCallId: string | null, toNumber: string | null, fromNumber: string | null): Promise<VoiceCallContext | null> {
  if (providerCallId) {
    const call = await prisma.call.findUnique({ where: { providerCallId }, include: { tenant: true } });
    if (call) return { tenant: call.tenant, cfg: resolveConfig(call.tenant), callRowId: call.id, callerNumber: call.fromNumber };
  }
  const to = normalizePhone(toNumber);
  if (to) {
    const num = await prisma.phoneNumber.findUnique({ where: { e164: to }, include: { tenant: true } });
    if (num) return { tenant: num.tenant, cfg: resolveConfig(num.tenant), callRowId: null, callerNumber: normalizePhone(fromNumber) };
  }
  return null;
}
