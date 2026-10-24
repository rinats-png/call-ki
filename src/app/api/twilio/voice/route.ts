import { logger } from "@/lib/logger";
import { ensurePlatformConfig } from "@/lib/platform/config";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { twimlResponse } from "@/lib/twiml";
import { resolveConfig } from "@/lib/tenant/settings";
import { findCustomerByPhone } from "@/lib/services/customers";
import { handoffCall, providerFor } from "@/lib/voice/handoff";
import { zeroRetention } from "@/lib/voice/retention-flags";
import { fallbackTwiml } from "@/lib/voice/fallback";
import { buildDynamicVariables, selectAgent } from "@/lib/voice/context";
import { minuteGate } from "@/lib/billing";
import { callAdmission } from "@/lib/cost-guard";
import { tenantForCalledNumber, twilioParams } from "@/lib/voice/inbound";
import { hit, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Twilio "A call comes in": angerufene Nummer → Mandant → gewählte Sprach-KI mit
 * Mandanten-Variablen. Bei Störung, Pause oder erschöpftem Kontingent: Fallback.
 */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const params = await twilioParams(req);
  if (!validateTwilioRequest(req.headers.get("x-twilio-signature"), publicUrl(req), params)) {
    logger.warn("twilio.invalid_signature");
    return new Response("Forbidden", { status: 403 });
  }

  const number = await tenantForCalledNumber(params.To);
  if (!number) {
    logger.warn("twilio.unknown_number", { to: params.To });
    return fallbackTwiml({});
  }
  const tenant = number.tenant;
  const from = normalizePhone(params.From) ?? "anonymous";

  const call = await prisma.call.upsert({
    where: { twilioCallSid: params.CallSid },
    create: { tenantId: tenant.id, twilioCallSid: params.CallSid, fromNumber: from, toNumber: number.e164 },
    update: {},
  });
  const fallback = (status: string) =>
    prisma.call.update({ where: { id: call.id }, data: { status } }).then(() =>
      fallbackTwiml({ companyName: tenant.name, fallbackNumber: number.fallbackNumber, callerId: params.To, recordingAction: `/api/twilio/recording?call=${call.id}` }),
    );

  if (tenant.status === "PAUSED") return fallback("FALLBACK");
  // Spam-/Kostenschutz: derselbe Anrufer sehr oft hintereinander → keine KI-Minuten verbrauchen
  if (from !== "anonymous" && hit(`calls:${number.e164}:${from}`, LIMITS.callsPerCaller) > 0) {
    logger.warn("twilio.caller_rate_limited", { tenantId: tenant.id, from: maskPhone(from) });
    return fallback("FALLBACK");
  }
  const gate = await minuteGate(tenant);
  if (gate.blocked) {
    logger.warn("tenant.minute_limit_reached", { tenantId: tenant.id, reason: gate.reason });
    return fallback("FALLBACK");
  }
  // Kostenschutz: Notschalter, gleichzeitige Anrufe, Tagesbudget der Plattform
  const admission = await callAdmission(tenant.id, call.id);
  if (!admission.ok) {
    logger.warn("call.admission_denied", { tenantId: tenant.id, reason: admission.reason });
    return fallback("FALLBACK");
  }

  try {
    const cfg = resolveConfig(tenant);
    const customer = from !== "anonymous" ? await findCustomerByPhone(tenant.id, from) : null;
    const choice = providerFor(number, tenant);
    // Aufzeichnungs-Hinweis: Retell wählt bei Bedarf den Agenten ohne Speicherung; andere Anbieter
    // gelten als speichernd, außer „Zero Retention“ ist für sie bestätigt.
    let agentId = choice.agentId;
    let recorded = true;
    if (choice.provider === "retell") {
      const a = selectAgent(choice.agentId, cfg);
      agentId = a.agentId;
      recorded = a.recorded;
    } else if (!cfg.settings.announceRecording && zeroRetention(choice.provider)) {
      recorded = false;
    }
    const result = await handoffCall({
      provider: choice.provider,
      agentId,
      recorded,
      fromNumber: from,
      toNumber: number.e164,
      tenant,
      callRowId: call.id,
      twilioCallSid: params.CallSid,
      dynamicVariables: buildDynamicVariables(tenant, cfg, { number: from, customer }, recorded),
    });
    await prisma.call.update({ where: { id: call.id }, data: { provider: result.provider, providerCallId: result.providerCallId, status: "IN_PROGRESS", customerId: customer?.id } });
    logger.info("twilio.inbound", { tenantId: tenant.id, from: maskPhone(from), provider: result.provider });
    return twimlResponse(result.twiml);
  } catch (err) {
    logger.error("twilio.ai_handoff_failed", { tenantId: tenant.id, error: (err as Error).message });
    return fallback("FALLBACK");
  }
}
