import type { Call, Tenant } from "@prisma/client";
import { prisma } from "../db";
import { logger } from "../logger";
import { normalizePhone } from "../phone";
import { assessUrgency } from "../urgency";
import type { TenantConfig } from "../tenant/settings";
import type { CallEvent } from "../voice/events";
import { resolveVoiceContext } from "../voice/context";
import { upsertCustomer } from "./customers";
import { notifyForTicket, routeRequest } from "./tickets";

const CALLBACK_PREFIX = "Gespräch ohne Abschluss – Rückruf erforderlich.";

/** Rückruf-Ticket für Anrufe ohne Abschluss (aufgelegt, Mailbox) – kein Lead geht verloren. Idempotent je Anruf. */
export async function createCallbackTicket(tenant: Tenant, cfg: TenantConfig, call: Pick<Call, "id" | "fromNumber" | "transcript" | "summary" | "recordingUrl">, note?: string) {
  const existing = await prisma.callTicket.findFirst({ where: { tenantId: tenant.id, callId: call.id } });
  if (existing) return existing;
  const phone = normalizePhone(call.fromNumber);
  if (!phone) return null; // unterdrückte Nummer ohne Daten: nur im Anrufprotokoll sichtbar

  const customer = await upsertCustomer(tenant.id, { phone });
  const text = `${call.summary ?? ""} ${call.transcript ?? ""}`;
  const urgency = assessUrgency({ description: text, customerType: customer.customerType, rules: cfg.urgencyRules });
  const routing = await routeRequest(tenant.id, cfg, { postalCode: customer.postalCode, urgency, customerType: customer.customerType });
  const ticket = await prisma.callTicket.create({
    data: {
      tenantId: tenant.id, customerId: customer.id, callId: call.id, assignedEmployeeId: routing.employee?.id,
      category: "Rückruf", urgency, status: urgency === "CRITICAL" ? "ESCALATED" : "PENDING",
      summary: [CALLBACK_PREFIX, note, call.summary].filter(Boolean).join(" "),
      transcript: call.transcript,
    },
    include: { customer: true },
  });
  await prisma.call.update({ where: { id: call.id }, data: { customerId: customer.id } });
  const employee = routing.employee ? await prisma.employee.findUnique({ where: { id: routing.employee.id } }) : null;
  await notifyForTicket(tenant, cfg, ticket, employee, null);
  return ticket;
}

/** Verarbeitet Retell/Vapi-Events: Anrufprotokoll, Transkript am Ticket, Rückruf-Ticket bei Abbruch. */
export async function handleCallEvent(ev: CallEvent) {
  const ctx = await resolveVoiceContext(ev.callId, ev.toNumber, ev.fromNumber, { twilioCallSid: ev.twilioCallSid, callRef: ev.callRef });
  if (!ctx) {
    logger.warn("voice.event_unknown_call", { callId: ev.callId });
    return null;
  }
  // Anruf ohne Twilio-Eingang (z. B. Vapi-Nummer oder Web-Call): Protokolleintrag nachziehen
  let call = ctx.callRowId ? await prisma.call.findUnique({ where: { id: ctx.callRowId } }) : null;
  if (!call && ev.callId) {
    call = await prisma.call.create({
      data: { tenantId: ctx.tenant.id, provider: ev.provider, providerCallId: ev.callId, fromNumber: normalizePhone(ev.fromNumber) ?? "anonymous", toNumber: normalizePhone(ev.toNumber) ?? "" },
    });
  }
  if (!call) return null;
  // Anbieter-ID nachtragen (ElevenLabs/Vapi kennen wir erst jetzt) – nötig für die spätere Löschung beim Anbieter
  if (ev.callId && !call.providerCallId && !(await prisma.call.findUnique({ where: { providerCallId: ev.callId } }))) {
    call = await prisma.call.update({ where: { id: call.id }, data: { providerCallId: ev.callId, provider: ev.provider } });
  }

  if (ev.kind === "started") {
    await prisma.call.update({ where: { id: call.id }, data: { status: "IN_PROGRESS" } });
    return call;
  }

  call = await prisma.call.update({
    where: { id: call.id },
    data: {
      status: "ENDED",
      endedAt: call.endedAt ?? new Date(),
      ...(ev.durationSec != null ? { durationSec: ev.durationSec } : {}),
      ...(ev.transcript ? { transcript: ev.transcript } : {}),
      ...(ev.summary ? { summary: ev.summary } : {}),
      ...(ev.recordingUrl ? { recordingUrl: ev.recordingUrl } : {}),
      ...(ev.endReason ? { endReason: ev.endReason } : {}),
    },
  });

  const tickets = await prisma.callTicket.findMany({ where: { tenantId: ctx.tenant.id, callId: call.id } });
  for (const t of tickets) {
    await prisma.callTicket.update({
      where: { id: t.id },
      data: {
        ...(call.transcript ? { transcript: call.transcript } : {}),
        // Rückruf-Tickets bekommen die (spätere) KI-Zusammenfassung
        ...(t.summary?.startsWith(CALLBACK_PREFIX) && call.summary && !t.summary.includes(call.summary) ? { summary: `${CALLBACK_PREFIX} ${call.summary}` } : {}),
      },
    });
  }

  const meaningful = (call.durationSec ?? 0) >= 15 || /(user|kunde|anrufer)\s*:/i.test(call.transcript ?? "");
  if (tickets.length === 0 && meaningful) await createCallbackTicket(ctx.tenant, ctx.cfg, call);
  return call;
}
