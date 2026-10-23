import { logger } from "@/lib/logger";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/db";
import { publicUrl, validateTwilioRequest } from "@/lib/security";
import { dialSip, twimlResponse } from "@/lib/twiml";
import { resolveConfig } from "@/lib/tenant/settings";
import { findCustomerByPhone } from "@/lib/services/customers";
import { registerRetellCall } from "@/lib/voice/retell";
import { fallbackTwiml } from "@/lib/voice/fallback";
import { buildDynamicVariables, minutesThisMonth } from "@/lib/voice/context";
import { tenantForCalledNumber, twilioParams } from "@/lib/voice/inbound";

export const dynamic = "force-dynamic";

/**
 * Twilio "A call comes in": angerufene Nummer → Mandant → Retell-Agent mit
 * Mandanten-Variablen. Bei Störung, Pause oder erschöpftem Kontingent: Fallback.
 */
export async function POST(req: Request) {
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
  if (tenant.monthlyMinuteLimit != null && (await minutesThisMonth(tenant)) >= tenant.monthlyMinuteLimit) {
    logger.warn("tenant.minute_limit_reached", { tenantId: tenant.id });
    return fallback("FALLBACK");
  }

  try {
    const cfg = resolveConfig(tenant);
    const customer = from !== "anonymous" ? await findCustomerByPhone(tenant.id, from) : null;
    const { callId, sipUri } = await registerRetellCall({
      agentId: number.voiceAgentId,
      fromNumber: from,
      toNumber: number.e164,
      metadata: { tenant_id: tenant.id, call_row_id: call.id, twilio_call_sid: params.CallSid },
      dynamicVariables: buildDynamicVariables(tenant, cfg, { number: from, customer }),
    });
    await prisma.call.update({ where: { id: call.id }, data: { providerCallId: callId, status: "IN_PROGRESS", customerId: customer?.id } });
    logger.info("twilio.inbound", { tenantId: tenant.id, from: maskPhone(from), callId });
    return twimlResponse(dialSip(sipUri));
  } catch (err) {
    logger.error("twilio.ai_handoff_failed", { tenantId: tenant.id, error: (err as Error).message });
    return fallback("FALLBACK");
  }
}
