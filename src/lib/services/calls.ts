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
import { resolveConfig } from "../tenant/settings";
import { runAfterResponse } from "../defer";
import { purgeCallAtProviders } from "../voice/providers";

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

  // Keine Einwilligung in die Aufzeichnung (Variante C): Aufnahme sofort beim Anbieter löschen
  const consentMode = ctx.cfg.settings.recordingConsent;
  if (!call.providerPurgedAt && (call.recordingConsent === "DENIED" || (consentMode === "ask" && call.recordingConsent !== "GRANTED"))) {
    const c = call;
    await prisma.call.update({ where: { id: c.id }, data: { recordingUrl: null } });
    call = { ...call, recordingUrl: null };
    runAfterResponse("call.purge_no_consent", async () => {
      const r = await purgeCallAtProviders(c);
      if (r.ok) await prisma.call.update({ where: { id: c.id }, data: { providerPurgedAt: new Date() } });
      logger.info("call.recording_purged_no_consent", { tenantId: ctx.tenant.id, callId: c.id, ok: r.ok });
    });
  }

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

/**
 * Schließt Anrufe, zu denen der KI-Anbieter nie ein Ende gemeldet hat: entweder hat Twilio das
 * Ende gemeldet und seitdem kam 10 Minuten nichts, oder es gibt gar kein Lebenszeichen mehr
 * (älter als Höchstdauer + 30 Minuten). Danach greifen Abrechnung und Löschfristen wieder.
 * Bei einem echten Gespräch ohne Vorgang entsteht ein Rückruf-Ticket. Läuft jede Minute.
 */
export async function closeStaleCalls(maxCallSec: number, now = new Date()) {
  const stale = await prisma.call.findMany({
    where: {
      status: { in: ["RINGING", "IN_PROGRESS"] },
      OR: [
        { endedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
        { endedAt: null, startedAt: { lt: new Date(now.getTime() - maxCallSec * 1000 - 30 * 60_000) } },
      ],
    },
    include: { tenant: true, tickets: { select: { id: true } } },
    take: 100,
  });
  let callbacks = 0;
  for (const c of stale) {
    const updated = await prisma.call.update({
      where: { id: c.id },
      data: { status: "ENDED", endedAt: c.endedAt ?? now, endReason: c.endReason ?? "no_provider_event", durationSec: c.durationSec ?? c.twilioDurationSec ?? null },
    });
    logger.warn("call.closed_without_provider_event", { tenantId: c.tenantId, callId: c.id, twilioEnded: !!c.endedAt });
    if (c.tickets.length === 0 && (c.twilioDurationSec ?? 0) >= 15) {
      await createCallbackTicket(c.tenant, resolveConfig(c.tenant), updated, "Gespräch ohne Abschlussmeldung des KI-Anbieters – bitte zurückrufen.");
      callbacks++;
    }
  }
  return { closed: stale.length, callbacks };
}
