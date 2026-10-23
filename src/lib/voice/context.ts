import type { Customer, Tenant } from "@prisma/client";
import { prisma } from "../db";
import { normalizePhone } from "../phone";
import { fromZoned, zonedParts } from "../time";
import { resolveConfig, type TenantConfig } from "../tenant/settings";
import { setting } from "../platform/config";
import type { CustomerType } from "../constants";

const DAY = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Erkennt, ob ein Text bereits offenlegt, dass eine KI spricht. */
const AI_DISCLOSURE = /\b(KI|künstliche[nr]?\s+Intelligenz|digitale[nr]?\s+Assist|virtuelle[nr]?\s+Assist|Sprachassist|automatische[nr]?\s+Assist|Telefonassistenz)/i;

/**
 * Begrüßung mit Pflichthinweisen: Offenlegung der KI (Art. 50 KI-Verordnung) und – falls
 * aktiviert – Aufzeichnungshinweis. Eine eigene Begrüßung des Kunden wird ergänzt, nie ersetzt.
 */
export function buildGreeting(companyName: string, s: TenantConfig["settings"], recorded = s.announceRecording): string {
  const recording = recorded ? " Das Gespräch wird zur Bearbeitung Ihres Anliegens aufgezeichnet." : "";
  if (!s.greeting) {
    return `${companyName}, guten Tag! Hier spricht ${s.assistantName}, die digitale Assistentin.${recording} Wie kann ich Ihnen helfen?`;
  }
  let g = s.greeting.trim();
  if (!AI_DISCLOSURE.test(g)) g = `${g} Sie sprechen mit ${s.assistantName}, der digitalen KI-Assistenz von ${companyName}.`;
  if (recording && !/aufgezeichnet|aufzeichnung|mitgeschnitten/i.test(g)) g += recording;
  return g;
}

/** Kurzer Datenschutzhinweis für Anrufer (erste Stufe der Art.-13-Information). */
export function buildPrivacyNotice(privacyUrl: string): string {
  const base = "Ihre Angaben verwenden wir nur zur Bearbeitung Ihres Anliegens.";
  if (!privacyUrl) return `${base} Ausführliche Informationen zum Datenschutz sendet Ihnen das Büro gern zu.`;
  const spoken = privacyUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return `${base} Informationen zum Datenschutz finden Sie unter ${spoken}.`;
}

/**
 * Dynamic Variables für den gemeinsamen Retell-Agenten. Ein Prompt-Template
 * (voice-agent/system-prompt.md) bedient so alle Mandanten.
 */
export function buildDynamicVariables(
  tenant: Tenant,
  cfg: TenantConfig,
  caller: { number: string; customer: Customer | null },
  /** Wird dieses Gespräch tatsächlich aufgezeichnet? (bestimmt den Hinweis in der Begrüßung) */
  recorded = cfg.settings.announceRecording,
): Record<string, string> {
  const s = cfg.settings;
  const t = cfg.template;
  const c = caller.customer;
  const now = new Date();
  const bh = s.businessHours;
  return {
    company_name: tenant.name,
    assistant_name: s.assistantName,
    greeting: buildGreeting(tenant.name, s, recorded),
    company_description: s.companyDescription || t.description,
    industry_context: t.promptContext,
    intake_questions: t.intakeQuestions.join(" "),
    categories: cfg.categories.join(", "),
    safety_rules: t.safetyRules.join(" ") || "–",
    service_area: s.serviceArea || "–",
    faq: s.faq || "–",
    pricing_policy: s.pricingPolicy,
    extra_instructions: s.extraInstructions || "–",
    privacy_notice: buildPrivacyNotice(s.privacyUrl),
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

/**
 * Wählt den Retell-Agenten so, dass NIE ohne Hinweis aufgezeichnet wird:
 *  - eigener Agent der Nummer → gilt als aufzeichnend (Hinweis an)
 *  - Kunde will keine Aufzeichnung + Plattform-Agent ohne Speicherung vorhanden → dieser, kein Hinweis
 *  - sonst Standard-Agent mit Hinweis
 */
export function selectAgent(numberAgentId: string | null, cfg: TenantConfig): { agentId: string | null; recorded: boolean } {
  if (numberAgentId) return { agentId: numberAgentId, recorded: true };
  const noStorage = setting("RETELL_AGENT_ID_NO_STORAGE");
  if (!cfg.settings.announceRecording && noStorage) return { agentId: noStorage, recorded: false };
  return { agentId: null, recorded: true };
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

/** Zusätzliche, vertrauenswürdige Zuordnungsmerkmale eines Anrufs */
export type CallRefs = { twilioCallSid?: string | null; callRef?: string | null };

/** SIP-Benutzer „ck4930123456“ (Vapi-SIP-Nummer der Plattform) → +4930123456 */
export function numberFromSipUser(v: string | null | undefined): string | null {
  const m = v?.match(/(?:sip:)?ck(\d{6,15})@/i) ?? v?.match(/^ck(\d{6,15})$/i);
  return m ? `+${m[1]}` : null;
}

/**
 * Ermittelt den Mandanten eines laufenden KI-Gesprächs. Vertrauensquelle ist
 * ausschließlich unsere eigene Call-Tabelle (beim Twilio-Eingang angelegt) bzw.
 * die angerufene Nummer – niemals ein Parameter, den die KI selbst setzt.
 */
export async function resolveVoiceContext(providerCallId: string | null, toNumber: string | null, fromNumber: string | null, refs: CallRefs = {}): Promise<VoiceCallContext | null> {
  const fromCall = (call: { id: string; fromNumber: string; tenant: Tenant } | null) =>
    call ? { tenant: call.tenant, cfg: resolveConfig(call.tenant), callRowId: call.id, callerNumber: call.fromNumber } : null;
  if (providerCallId) {
    const hit = fromCall(await prisma.call.findUnique({ where: { providerCallId }, include: { tenant: true } }));
    if (hit) return hit;
  }
  if (refs.twilioCallSid) {
    const hit = fromCall(await prisma.call.findUnique({ where: { twilioCallSid: refs.twilioCallSid }, include: { tenant: true } }));
    if (hit) return hit;
  }
  const to = normalizePhone(toNumber) ?? numberFromSipUser(toNumber);
  if (refs.callRef) {
    // Referenz aus unserer eigenen SIP-Weiterleitung: nur frische Anrufe, passende Zielnummer
    const call = await prisma.call.findFirst({ where: { id: refs.callRef, startedAt: { gte: new Date(Date.now() - 3 * 3600_000) }, ...(to ? { toNumber: to } : {}) }, include: { tenant: true } });
    const hit = fromCall(call);
    if (hit) return hit;
  }
  if (to) {
    const num = await prisma.phoneNumber.findUnique({ where: { e164: to }, include: { tenant: true } });
    if (num) return { tenant: num.tenant, cfg: resolveConfig(num.tenant), callRowId: null, callerNumber: normalizePhone(fromNumber) };
  }
  return null;
}
