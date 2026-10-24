import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveConfig } from "@/lib/tenant/settings";
import { processServiceRequest } from "@/lib/services/tickets";
import { findCustomerByPhone } from "@/lib/services/customers";
import { handleCallEvent } from "@/lib/services/calls";
import { resolveVoiceContext } from "@/lib/voice/context";
import { runTool } from "@/lib/voice/tools";
import { processToolBody } from "@/lib/voice/handle-tools";
import { settleDeferred } from "@/lib/defer";
import { recordHeartbeat, runMonitor } from "@/lib/services/monitor";
import { checkTwilioNumbers } from "@/lib/voice/twilio-config";
import { callAdmission, enforceCallLimits } from "@/lib/cost-guard";
import { runQuotaWarnings } from "@/lib/services/usage-alerts";
import { closeStaleCalls } from "@/lib/services/calls";
import { usageForMonth, currentMonth } from "@/lib/billing";
import { computeTwilioSignature } from "@/lib/security";
import { POST as twilioStatus } from "@/app/api/twilio/status/route";
import { assertNumberSlot, assertUserSlot } from "@/lib/plan-limits";
import { applyPlanToConfig } from "@/lib/voice/context";
import { effectivePlan } from "@/lib/billing";
import { runAppointmentReminders } from "@/lib/services/reminders";
import { hitShared } from "@/lib/rate-limit";
import { closeDueMonths } from "@/lib/services/billing-close";
import { eraseCustomer } from "@/lib/services/customers";
import { monthRange } from "@/lib/billing";
import { resealAll } from "@/lib/services/rekey";
import { seal, open as unseal } from "@/lib/secret-box";
import { retryDueMessages, MAX_ATTEMPTS, sendSms } from "@/lib/notify";
import { resetEnvCache } from "@/lib/env";
import { vi } from "vitest";
import { findAvailableSlots } from "@/lib/calendar";
import { deleteTenant, exportTenantData } from "@/lib/services/tenants";
import { bookMinutePack, decidePlanChange, requestPlanChange } from "@/lib/services/billing-requests";
import { billingCsv, billingReport } from "@/lib/services/billing-report";
import { minuteGate } from "@/lib/billing";

/**
 * Integrationstests gegen echte PostgreSQL-Datenbank.
 * Ausführen: TEST_DATABASE_URL=postgresql://… npx prisma migrate deploy && TEST_DATABASE_URL=… npm test
 */
const enabled = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)("Mandantentrennung & Sprach-Pipeline", () => {
  let A: Awaited<ReturnType<typeof mk>>;
  let B: Awaited<ReturnType<typeof mk>>;
  const SAME_CALLER = "+4917612345678";

  async function mk(name: string, number: string, industry: string) {
    const tenant = await prisma.tenant.create({ data: { name, slug: name.toLowerCase().replace(/\W/g, "-"), industry, status: "ACTIVE", settings: { appointments: { leadMin: 0, bufferMin: 30 } } } });
    await prisma.phoneNumber.create({ data: { tenantId: tenant.id, e164: number } });
    const tech = await prisma.employee.create({ data: { tenantId: tenant.id, name: `${name} Techniker`, role: "FIELD_TECH", servicePostalCodes: "*", email: null } });
    return { tenant, tech, cfg: resolveConfig(tenant), number };
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Tenant", "User", "Message", "SystemState", "Plan", "RateLimitHit", "BillingSnapshot" CASCADE');
    A = await mk("Alpha Schädlinge", "+493011111111", "pest_control");
    B = await mk("Beta Sanitär", "+493022222222", "trades");
  });
  afterAll(async () => {
    await settleDeferred();
    await prisma.$disconnect();
  });

  it("ordnet Anrufe über die angerufene Nummer dem richtigen Mandanten zu", async () => {
    expect((await resolveVoiceContext(null, A.number, SAME_CALLER))?.tenant.id).toBe(A.tenant.id);
    expect((await resolveVoiceContext(null, B.number, SAME_CALLER))?.tenant.id).toBe(B.tenant.id);
    expect(await resolveVoiceContext(null, "+499999999", SAME_CALLER)).toBeNull();
  });

  it("trennt Kundendaten strikt – gleiche Rufnummer, zwei Mandanten", async () => {
    await processServiceRequest(A.tenant, A.cfg, { customer: { phone: SAME_CALLER, name: "Kunde bei Alpha" }, category: "Wespen", description: "Nest am Fenster" });
    expect((await findCustomerByPhone(A.tenant.id, SAME_CALLER))?.name).toBe("Kunde bei Alpha");
    expect(await findCustomerByPhone(B.tenant.id, SAME_CALLER)).toBeNull();

    const ctxB = (await resolveVoiceContext(null, B.number, SAME_CALLER))!;
    const idB = (await runTool("identify_caller", {}, ctxB)) as { status: string };
    expect(idB.status).toBe("NEW"); // B sieht den Kunden von A nicht
    expect(await prisma.callTicket.count({ where: { tenantId: B.tenant.id } })).toBe(0);
  });

  it("ignoriert fremde Mitarbeiter-IDs aus den KI-Argumenten", async () => {
    const ctxB = (await resolveVoiceContext(null, B.number, SAME_CALLER))!;
    const res = (await runTool("book_appointment", { description: "Rohrbruch im Bad", category: "Rohrbruch", employeeId: A.tech.id }, ctxB)) as { ok: boolean; employee: string };
    expect(res.ok).toBe(true);
    expect(res.employee).toBe(B.tech.name);
  });

  it("verhindert Doppelbuchungen und arbeitet idempotent je Anruf", async () => {
    const call = await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-1", fromNumber: "+4915000000001", toNumber: A.number } });
    const ctx = (await resolveVoiceContext("retell-1", null, null))!;
    expect(ctx.callRowId).toBe(call.id);

    const { slots } = await findAvailableSlots(A.tenant, A.cfg, A.tech);
    const slot = slots[0].start.toISOString();
    const first = (await runTool("book_appointment", { description: "Ratten im Keller", category: "Ratten", appointmentStart: slot, employeeId: A.tech.id }, ctx)) as { ok: boolean };
    expect(first.ok).toBe(true);
    // KI ruft dasselbe Tool erneut auf → kein zweites Ticket
    await runTool("book_appointment", { description: "Ratten im Keller (ergänzt)", category: "Ratten", appointmentStart: slot, employeeId: A.tech.id }, ctx);
    expect(await prisma.callTicket.count({ where: { callId: call.id } })).toBe(1);

    // Anderer Anrufer will denselben Slot → abgelehnt mit Alternativen
    await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-2", fromNumber: "+4915000000002", toNumber: A.number } });
    const ctx2 = (await resolveVoiceContext("retell-2", null, null))!;
    const second = (await runTool("book_appointment", { description: "Mäuse", category: "Mäuse", appointmentStart: slot, employeeId: A.tech.id }, ctx2)) as { ok: boolean; slotTaken: boolean; slots: unknown[] };
    expect(second.ok).toBe(false);
    expect(second.slotTaken).toBe(true);
    expect(second.slots.length).toBeGreaterThan(0);
  });

  it("hängt Transkripte an und legt bei Abbruch ein Rückruf-Ticket an", async () => {
    await handleCallEvent({ provider: "retell", kind: "analyzed", callId: "retell-1", fromNumber: null, toNumber: null, transcript: "Agent: Hallo\nUser: Ratten", summary: "Ratten im Keller", durationSec: 120, recordingUrl: "https://rec/1", endReason: "user_hangup" });
    const t = await prisma.callTicket.findFirst({ where: { call: { providerCallId: "retell-1" } } });
    expect(t?.transcript).toContain("User: Ratten");

    await prisma.call.create({ data: { tenantId: B.tenant.id, providerCallId: "retell-3", fromNumber: "+4915000000003", toNumber: B.number } });
    await handleCallEvent({ provider: "retell", kind: "ended", callId: "retell-3", fromNumber: null, toNumber: null, transcript: "Agent: Hallo\nUser: Heizung ist aus und", summary: null, durationSec: 40, recordingUrl: null, endReason: "user_hangup" });
    const cb = await prisma.callTicket.findFirst({ where: { tenantId: B.tenant.id, call: { providerCallId: "retell-3" } } });
    expect(cb?.category).toBe("Rückruf");
    expect(cb?.urgency).toBe("HIGH"); // "heizung aus" laut Handwerk-Vorlage
    // erneutes Event erzeugt kein zweites Ticket
    await handleCallEvent({ provider: "retell", kind: "analyzed", callId: "retell-3", fromNumber: null, toNumber: null, transcript: null, summary: "Heizungsausfall", durationSec: 40, recordingUrl: null, endReason: null });
    expect(await prisma.callTicket.count({ where: { call: { providerCallId: "retell-3" } } })).toBe(1);
  });

  it("protokolliert Benachrichtigungen auch ohne Versanddienst", async () => {
    const msgs = await prisma.message.findMany({ where: { tenantId: A.tenant.id } });
    expect(msgs.every((m) => m.tenantId === A.tenant.id)).toBe(true);
  });
  it("exportiert nur Daten des eigenen Mandanten", async () => {
    const exp = await exportTenantData(A.tenant.id);
    expect(exp?.calls.length).toBeGreaterThan(0);
    expect(exp?.customers.every((c) => c.tenantId === A.tenant.id)).toBe(true);
    expect(exp?.tickets.every((t) => t.tenantId === A.tenant.id)).toBe(true);
    expect(JSON.stringify(exp)).not.toContain("passwordHash");
  });

  it("gibt Kundendaten nur zur verifizierten Anrufernummer heraus", async () => {
    await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-fremd", fromNumber: "+4915000000009", toNumber: A.number } });
    const ctx = (await resolveVoiceContext("retell-fremd", null, null))!;
    // Anrufer nennt die Nummer eines Bestandskunden → keine fremden Daten
    const id = (await runTool("identify_caller", { phone: SAME_CALLER }, ctx)) as Record<string, unknown>;
    expect(id.status).toBe("NEW");
    expect(JSON.stringify(id)).not.toContain("Kunde bei Alpha");
    // Speichern unter dieser Nummer überschreibt den Bestandskunden nicht und meldet nichts zurück
    const saved = (await runTool("save_customer", { phone: SAME_CALLER, name: "Angreifer", postalCode: "10115" }, ctx)) as Record<string, unknown>;
    expect(saved).toEqual({ ok: true });
    const c = await findCustomerByPhone(A.tenant.id, SAME_CALLER);
    expect(c?.name).toBe("Kunde bei Alpha");
    expect(c?.postalCode).toBe("10115"); // Lücke darf gefüllt werden
  });

  it("speichert Gewerbekunden auch mit dem alten Wert B2B_HACCP als BUSINESS", async () => {
    const ctx = (await resolveVoiceContext("retell-fremd", null, null))!;
    await runTool("save_customer", { name: "Restaurant Domblick", customerType: "B2B_HACCP" }, ctx);
    expect((await findCustomerByPhone(A.tenant.id, "+4915000000009"))?.customerType).toBe("BUSINESS");
  });

  it("bindet ElevenLabs-/SIP-Funktionen fest an einen laufenden Anruf", async () => {
    const active = await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: "CA" + "a".repeat(32), fromNumber: "+4915000000010", toNumber: A.number } });
    await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: "CA" + "b".repeat(32), fromNumber: SAME_CALLER, toNumber: A.number, startedAt: new Date(Date.now() - 20 * 60_000), endedAt: new Date(Date.now() - 10 * 60_000) } });
    const ask = (body: Record<string, unknown>) => processToolBody(body, "elevenlabs", "identify_caller") as Promise<Record<string, unknown>>;

    // Nur angerufene Nummer, kein Anruf → abgelehnt (früher: Mandant über die Nummer)
    expect(String((await ask({ called_number: A.number, caller_id: SAME_CALLER })).error)).toContain("keinem Kunden");
    // Beendeter Anruf (auch wenn die KI dessen Kennung kennt) → abgelehnt
    expect(String((await ask({ call_sid: "CA" + "b".repeat(32) })).error)).toContain("keinem Kunden");
    // Laufender Anruf → Anrufernummer kommt aus unserer Anrufzeile, nicht aus dem Body
    const ok = await ask({ call_sid: active.twilioCallSid, caller_id: SAME_CALLER });
    expect(ok.status).toBe("NEW");
    expect(ok.phone).toBe("+4915000000010");
  });

  it("lehnt Funktionsaufrufe im Format eines anderen Anbieters ab", async () => {
    expect(await processToolBody({ name: "identify_caller", args: {}, call: { call_id: "retell-fremd" } }, "elevenlabs")).toBeNull();
    expect(await processToolBody({ name: "identify_caller", args: {}, call: { call_id: "retell-fremd" } }, "retell")).not.toBeNull();
  });

  it("stellt Notfälle über Twilio selbst durch – Ziel nur aus den eigenen Daten, nur freigegebene Länder", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC" + "1".repeat(32), TWILIO_AUTH_TOKEN: "t" });
    resetEnvCache();
    const calls: { url: string; body: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => { calls.push({ url: String(url), body: String(init?.body ?? "") }); return new Response("{}", { status: 200 }); }) as typeof fetch;
    try {
      await prisma.employee.update({ where: { id: A.tech.id }, data: { directPhone: "+4915199999999", role: "EMERGENCY_TECH" } });
      const call = await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: "CA" + "f".repeat(32), fromNumber: "+4915000000120", toNumber: A.number } });
      const ctx = (await resolveVoiceContext(null, null, null, { twilioCallSid: call.twilioCallSid! }, { activeOnly: true }))!;
      const sos = (await runTool("escalate_emergency", { description: "Wasser steht im Keller", category: "Notfall", phone: "+99912345678" }, ctx)) as { transferring?: boolean; transferNumber: string | null };
      expect(sos.transferring).toBe(true);
      expect(sos.transferNumber).toBeNull();
      await settleDeferred();
      const redirect = calls.find((c) => c.url.includes(`/Calls/${call.twilioCallSid}.json`));
      expect(decodeURIComponent(redirect?.body ?? "")).toContain("+4915199999999");

      // Ziel in einem nicht freigegebenen Land → keine Durchstellung, Rückruf
      await prisma.employee.update({ where: { id: A.tech.id }, data: { directPhone: "+88213000000" } });
      const sos2 = (await runTool("escalate_emergency", { description: "Wasser", category: "Notfall" }, ctx)) as { transferring?: boolean; transferNumber: string | null };
      expect(sos2.transferring).toBeUndefined();
      expect(sos2.transferNumber).toBeNull();
    } finally {
      globalThis.fetch = realFetch;
      await prisma.employee.update({ where: { id: A.tech.id }, data: { directPhone: null, role: "FIELD_TECH" } });
      for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]) delete process.env[k];
      resetEnvCache();
    }
  }, 20_000);

  it("vertraut bei Retell/Vapi ohne eigene Anrufzeile nicht der Anrufernummer aus dem Body", async () => {
    const res = (await processToolBody({ name: "identify_caller", args: {}, call: { call_id: "retell-unbekannt", to_number: A.number, from_number: SAME_CALLER } }, "retell")) as Record<string, unknown>;
    expect(JSON.stringify(res)).not.toContain("Kunde bei Alpha");
  });

  it("sendet keine SMS in nicht freigegebene Länder (SMS-Pumping)", async () => {
    const r = await sendSms({ tenantId: A.tenant.id, to: "+88213000000", body: "Test", purpose: "CUSTOMER_CONFIRMATION" });
    expect(r.status).toBe("SKIPPED");
    expect((await prisma.message.findUnique({ where: { id: r.id } }))?.error).toContain("Zielland");
  });

  it("lässt die Sprach-KI nicht auf den Versand warten und versendet danach", async () => {
    await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-defer", fromNumber: "+4915000000020", toNumber: A.number } });
    const ctx = (await resolveVoiceContext("retell-defer", null, null))!;
    const res = (await runTool("book_appointment", { description: "Wespennest am Dach", category: "Wespen", email: "kunde@example.org" }, ctx)) as { ok: boolean; say: string };
    expect(res.ok).toBe(true);
    expect(res.say).toContain("meldet sich"); // ohne Termin: Rückmeldung angekündigt
    await settleDeferred();
    const ticket = await prisma.callTicket.findFirst({ where: { callId: (await prisma.call.findUnique({ where: { providerCallId: "retell-defer" } }))!.id } });
    // Kundenbestätigung wurde nach der Antwort protokolliert (ohne SMTP als SKIPPED)
    expect(await prisma.message.findFirst({ where: { ticketId: ticket!.id, purpose: "CUSTOMER_CONFIRMATION" } })).toMatchObject({ status: "SKIPPED", recipient: "kunde@example.org" });
  });

  it("wiederholt fehlgeschlagene SMS mit Pause und gibt nach der Höchstzahl auf", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32), TWILIO_AUTH_TOKEN: "t", TWILIO_SMS_FROM: "+4930000000" });
    resetEnvCache();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const msg = await prisma.message.create({ data: { tenantId: A.tenant.id, channel: "SMS", recipient: "+4915000000030", body: "Notfall", purpose: "EMERGENCY_ALERT", status: "FAILED", attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) } });
      // noch nicht fällig → kein Versuch
      await prisma.message.update({ where: { id: msg.id }, data: { nextAttemptAt: new Date(Date.now() + 60_000) } });
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "down" }), { status: 503 }));
      expect((await retryDueMessages()).due).toBe(0);
      // fällig, schlägt fehl → nächster Versuch geplant
      await prisma.message.update({ where: { id: msg.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
      expect((await retryDueMessages()).failed).toBe(1);
      let m = (await prisma.message.findUnique({ where: { id: msg.id } }))!;
      expect(m.attempts).toBe(2);
      expect(m.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
      // letzter erlaubter Versuch schlägt fehl → aufgegeben
      await prisma.message.update({ where: { id: msg.id }, data: { attempts: MAX_ATTEMPTS - 1, nextAttemptAt: new Date(Date.now() - 1000) } });
      await retryDueMessages();
      m = (await prisma.message.findUnique({ where: { id: msg.id } }))!;
      expect(m.status).toBe("FAILED");
      expect(m.nextAttemptAt).toBeNull();
      // zweite Nachricht: Wiederholung klappt
      const ok = await prisma.message.create({ data: { tenantId: A.tenant.id, channel: "SMS", recipient: "+4915000000031", body: "Termin", purpose: "CUSTOMER_CONFIRMATION", status: "FAILED", attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) } });
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }));
      expect((await retryDueMessages()).sent).toBe(1);
      expect((await prisma.message.findUnique({ where: { id: ok.id } }))?.status).toBe("SENT");
    } finally {
      fetchMock.mockRestore();
      for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"]) delete process.env[k];
      resetEnvCache();
    }
  });

  it("alarmiert bei nicht versendeten Notfall-Alarmen, hängenden Anrufen und fehlendem Backup – ohne Wiederholungsflut", async () => {
    process.env.ALERT_EMAIL = "betrieb@example.org";
    process.env.BACKUP_EXPECTED = "true";
    try {
      await prisma.message.create({ data: { tenantId: A.tenant.id, channel: "SMS", recipient: "+4915000000040", body: "Notfall", purpose: "EMERGENCY_ALERT", status: "SKIPPED" } });
      await prisma.call.create({ data: { tenantId: A.tenant.id, fromNumber: "+4915000000041", toNumber: A.number, status: "IN_PROGRESS", startedAt: new Date(Date.now() - 3 * 3600_000) } });
      const first = await runMonitor();
      const ids = first.findings.map((f) => f.id.split(":")[0]);
      expect(ids).toEqual(expect.arrayContaining(["emergency-skipped", "calls-hanging", "backup-missing", "restore-test-missing"]));
      expect(first.alerted).toBe(first.findings.length);
      const alerts = await prisma.message.findMany({ where: { purpose: "PLATFORM_ALERT", recipient: "betrieb@example.org" } });
      expect(alerts.length).toBe(first.findings.length);
      expect(alerts.map((a) => a.body).join()).not.toMatch(/\+49\d{6,}/); // keine Rufnummern im Alarm
      // gleicher Zustand kurz danach → keine erneuten Alarme
      expect((await runMonitor()).alerted).toBe(0);
      // Backup meldet sich → Befund verschwindet
      await recordHeartbeat("backup", true);
      expect((await runMonitor()).findings.some((f) => f.id.startsWith("backup"))).toBe(false);
      await recordHeartbeat("restore-test", false, "pg_restore fehlgeschlagen");
      expect((await runMonitor()).findings.find((f) => f.id.startsWith("restore-test"))?.level).toBe("critical");
    } finally {
      delete process.env.ALERT_EMAIL;
      delete process.env.BACKUP_EXPECTED;
    }
  });

  it("alarmiert bei einer Häufung fehlgeschlagener Anmeldungen", async () => {
    await prisma.auditLog.createMany({ data: Array.from({ length: 30 }, () => ({ tenantId: A.tenant.id, action: "auth.login_failed" })) });
    const r = await runMonitor();
    expect(r.findings.some((f) => f.id.startsWith("auth-failures:"))).toBe(true);
    await prisma.auditLog.deleteMany({ where: { action: "auth.login_failed" } });
  });

  it("erkennt Rufnummern ohne unabhängiges Ersatzziel bei Twilio", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32), TWILIO_AUTH_TOKEN: "t", PUBLIC_BASE_URL: "https://app.example.de" });
    resetEnvCache();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      incoming_phone_numbers: [
        // A: Ersatzziel auf dem eigenen Server
        { phone_number: A.number, voice_url: "https://app.example.de/api/twilio/voice", voice_fallback_url: "https://app.example.de/api/twilio/fallback" },
      ],
      next_page_uri: null,
    }), { status: 200 }));
    try {
      const r = (await checkTwilioNumbers())!;
      expect(r.problems.join("\n")).toContain("Ersatzziel liegt auf dem eigenen Server");
      expect(r.problems.join("\n")).toContain("keine Weiterleitungsnummer");
      expect(r.problems.join("\n")).toContain(`${B.number} (${B.tenant.name}): nicht im Twilio-Konto`);
      // korrekt eingerichtet → keine Probleme für A
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ incoming_phone_numbers: [{ phone_number: A.number, voice_url: "https://app.example.de/api/twilio/voice", voice_fallback_url: "https://handler.twilio.com/twiml/EH123", status_callback: "https://app.example.de/api/twilio/status" }], next_page_uri: null }), { status: 200 }));
      await prisma.phoneNumber.update({ where: { e164: A.number }, data: { fallbackNumber: "+4915199999999" } });
      expect((await checkTwilioNumbers())!.problems.filter((p) => p.startsWith(A.number))).toEqual([]);
    } finally {
      fetchMock.mockRestore();
      for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"]) delete process.env[k];
      resetEnvCache();
    }
  });

  it("lässt nur begrenzt viele gleichzeitige Anrufe zur KI und hat einen Notschalter", async () => {
    const mk = (n: number) => prisma.call.create({ data: { tenantId: A.tenant.id, fromNumber: `+491500000005${n}`, toNumber: A.number, status: "IN_PROGRESS" } });
    const own = await prisma.call.create({ data: { tenantId: A.tenant.id, fromNumber: "+4915000000059", toNumber: A.number } });
    process.env.MAX_CONCURRENT_CALLS_PER_TENANT = "2";
    try {
      await prisma.call.updateMany({ where: { tenantId: A.tenant.id, endedAt: null }, data: { endedAt: new Date() } });
      await prisma.call.update({ where: { id: own.id }, data: { endedAt: null, status: "RINGING" } });
      await mk(1);
      expect(await callAdmission(A.tenant.id, own.id)).toEqual({ ok: true });
      await mk(2);
      expect(await callAdmission(A.tenant.id, own.id)).toEqual({ ok: false, reason: "tenant_concurrency" });
      expect(await callAdmission(B.tenant.id, "x")).toEqual({ ok: true }); // anderer Kunde unberührt
      process.env.AI_KILL_SWITCH = "on";
      expect(await callAdmission(B.tenant.id, "x")).toEqual({ ok: false, reason: "kill_switch" });
    } finally {
      delete process.env.MAX_CONCURRENT_CALLS_PER_TENANT;
      delete process.env.AI_KILL_SWITCH;
      await prisma.call.updateMany({ where: { tenantId: A.tenant.id, endedAt: null }, data: { endedAt: new Date(), status: "ENDED" } });
    }
  });

  it("stoppt neue KI-Anrufe beim Tagesbudget der Plattform", async () => {
    process.env.PLATFORM_DAILY_MINUTE_LIMIT = "10";
    try {
      await prisma.call.create({ data: { tenantId: B.tenant.id, fromNumber: "+4915000000060", toNumber: B.number, status: "ENDED", endedAt: new Date(), durationSec: 11 * 60 } });
      expect(await callAdmission(B.tenant.id, "x")).toEqual({ ok: false, reason: "platform_daily_budget" });
    } finally {
      delete process.env.PLATFORM_DAILY_MINUTE_LIMIT;
    }
  });

  it("beendet Gespräche über der Höchstdauer bei Twilio", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32), TWILIO_AUTH_TOKEN: "t", MAX_CALL_MINUTES: "10" });
    resetEnvCache();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    try {
      const long = await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: "CA" + "c".repeat(32), fromNumber: "+4915000000061", toNumber: A.number, status: "IN_PROGRESS", startedAt: new Date(Date.now() - 13 * 60_000) } });
      await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: "CA" + "d".repeat(32), fromNumber: "+4915000000062", toNumber: A.number, status: "IN_PROGRESS", startedAt: new Date(Date.now() - 5 * 60_000) } });
      const r = await enforceCallLimits();
      expect(r.ended).toBe(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain(`/Calls/${long.twilioCallSid}.json`);
    } finally {
      fetchMock.mockRestore();
      for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "MAX_CALL_MINUTES"]) delete process.env[k];
      resetEnvCache();
      await prisma.call.updateMany({ where: { tenantId: A.tenant.id, endedAt: null }, data: { endedAt: new Date(), status: "ENDED" } });
    }
  });

  it("warnt Kunden einmalig bei 80 % und 100 % des Kontingents", async () => {
    await prisma.user.create({ data: { email: "chef@beta.example", role: "TENANT_ADMIN", tenantId: B.tenant.id } });
    await prisma.tenant.update({ where: { id: B.tenant.id }, data: { monthlyMinuteLimit: 20, status: "ACTIVE" } });
    await prisma.call.create({ data: { tenantId: B.tenant.id, fromNumber: "+4915000000063", toNumber: B.number, status: "ENDED", endedAt: new Date(), durationSec: 7 * 60 } });
    // insgesamt 11 + 7 = 18 von 20 Minuten = 90 %
    await runQuotaWarnings();
    let mails = await prisma.message.findMany({ where: { purpose: "QUOTA_WARNING", recipient: "chef@beta.example" } });
    expect(mails.map((m) => m.subject)).toEqual(["80 % Ihrer Minutengrenze verbraucht"]);
    await runQuotaWarnings(); // keine Wiederholung
    expect(await prisma.message.count({ where: { purpose: "QUOTA_WARNING" } })).toBe(1);
    await prisma.call.create({ data: { tenantId: B.tenant.id, fromNumber: "+4915000000064", toNumber: B.number, status: "ENDED", endedAt: new Date(), durationSec: 3 * 60 } });
    await runQuotaWarnings();
    mails = await prisma.message.findMany({ where: { purpose: "QUOTA_WARNING" }, orderBy: { createdAt: "asc" } });
    expect(mails.map((m) => m.subject)).toEqual(["80 % Ihrer Minutengrenze verbraucht", "100 % Ihrer Minutengrenze verbraucht"]);
    expect(mails[1].body).toContain("keine Anrufe mehr an");
    await prisma.tenant.update({ where: { id: B.tenant.id }, data: { monthlyMinuteLimit: null } });
  });

  it("übernimmt Gesprächsende und Dauer von Twilio, schließt Anrufe ohne Anbieter-Ereignis und rechnet nach Twilio-Dauer ab", async () => {
    Object.assign(process.env, { TWILIO_AUTH_TOKEN: "tok", PUBLIC_BASE_URL: "https://app.example.de" });
    resetEnvCache();
    try {
      const sid = "CA" + "e".repeat(32);
      const call = await prisma.call.create({ data: { tenantId: A.tenant.id, twilioCallSid: sid, fromNumber: "+4915000000070", toNumber: A.number, status: "IN_PROGRESS", startedAt: new Date(Date.now() - 20 * 60_000) } });
      const params = { CallSid: sid, CallStatus: "completed", CallDuration: "95" };
      const send = (sig: string) => twilioStatus(new Request("https://app.example.de/api/twilio/status", { method: "POST", headers: { "x-twilio-signature": sig, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) }));
      expect((await send("falsch")).status).toBe(403);
      expect((await send(computeTwilioSignature("tok", "https://app.example.de/api/twilio/status", params))).status).toBe(204);
      let c = (await prisma.call.findUnique({ where: { id: call.id } }))!;
      expect(c.twilioDurationSec).toBe(95);
      expect(c.endedAt).not.toBeNull();
      expect(c.status).toBe("IN_PROGRESS"); // Anbieter-Ereignis kann noch kommen

      // 10 Minuten ohne Anbieter-Ereignis → geschlossen + Rückruf-Ticket
      await prisma.call.update({ where: { id: call.id }, data: { endedAt: new Date(Date.now() - 11 * 60_000) } });
      const r = await closeStaleCalls(20 * 60);
      expect(r.closed).toBeGreaterThanOrEqual(1);
      c = (await prisma.call.findUnique({ where: { id: call.id } }))!;
      expect(c).toMatchObject({ status: "ENDED", endReason: "no_provider_event", durationSec: 95 });
      expect(await prisma.callTicket.count({ where: { callId: call.id, category: "Rückruf" } })).toBe(1);

      // Abrechnung nimmt die Twilio-Dauer, auch wenn der Anbieter eine kürzere meldet
      const before = await usageForMonth(A.tenant, currentMonth(A.tenant.timezone).year, currentMonth(A.tenant.timezone).month, 1);
      await prisma.call.update({ where: { id: call.id }, data: { durationSec: 30 } });
      const after = await usageForMonth(A.tenant, currentMonth(A.tenant.timezone).year, currentMonth(A.tenant.timezone).month, 1);
      expect(after.seconds).toBe(before.seconds);
    } finally {
      for (const k of ["TWILIO_AUTH_TOKEN", "PUBLIC_BASE_URL"]) delete process.env[k];
      resetEnvCache();
    }
  });

  it("bucht Minutenpakete (sofort wirksam, auf der Rechnung) und stellt Pakete nach Freigabe um", async () => {
    const base = await prisma.plan.create({ data: { key: "stopp", name: "Stopp", monthlyPriceCents: 4900, includedMinutes: 0, overageCentsPerMinute: 30, overageMode: "BLOCK" } });
    const big = await prisma.plan.create({ data: { key: "gross", name: "Groß", monthlyPriceCents: 14900, includedMinutes: 1000, overageCentsPerMinute: 25 } });
    await prisma.tenant.update({ where: { id: B.tenant.id }, data: { planId: base.id } });
    const tenant = () => prisma.tenant.findUniqueOrThrow({ where: { id: B.tenant.id }, include: { planRef: true } });
    try {
      // Kontingent 0 im Stopp-Modus → gesperrt; nach 100 Minuten Nachbuchung wieder frei
      expect((await minuteGate(await tenant())).blocked).toBe(true);
      await expect(bookMinutePack(B.tenant.id, "u-test", 42)).rejects.toThrow(/Unbekanntes/);
      const top = await bookMinutePack(B.tenant.id, "u-test", 100);
      expect(top.priceCents).toBe(3000);
      expect((await minuteGate(await tenant())).blocked).toBe(false);
      const { year, month } = currentMonth(B.tenant.timezone);
      const row = (await billingReport(year, month, B.tenant.id))[0];
      expect(row.plan.includedMinutes).toBe(100);
      expect(row.invoice.lines.map((l) => l.label)).toContain("Minutenpaket +100 Min.");
      expect(row.invoice.netCents).toBe(4900 + 3000);

      // Paketwechsel: nur eine offene Anfrage, Umstellung erst durch den Betreiber
      const req = await requestPlanChange(B.tenant.id, "u-test", big.id, "ab sofort bitte");
      await expect(requestPlanChange(B.tenant.id, "u-test", big.id, "")).rejects.toThrow(/offene Anfrage/);
      expect((await tenant()).planId).toBe(base.id);
      await decidePlanChange(req.id, "u-test", true);
      expect((await tenant()).planId).toBe(big.id);
      await expect(decidePlanChange(req.id, "u-test", false)).rejects.toThrow(/erledigt/);
    } finally {
      await prisma.tenant.update({ where: { id: B.tenant.id }, data: { planId: null } });
      await prisma.minuteTopUp.deleteMany({ where: { tenantId: B.tenant.id } });
    }
  });

  it("setzt Paketgrenzen durch: Zugänge, Rufnummern und Funktionen", async () => {
    const plan = await prisma.plan.create({ data: { key: "mini", name: "Mini", monthlyPriceCents: 4900, includedMinutes: 100, overageCentsPerMinute: 39, maxUsers: 1, maxNumbers: 1, features: ["sms"] } });
    await prisma.tenant.update({ where: { id: B.tenant.id }, data: { planId: plan.id } });
    try {
      // chef@beta.example existiert schon → Zugang Nr. 2 nicht erlaubt
      await expect(assertUserSlot(B.tenant.id)).rejects.toThrow(/1 Zugänge/);
      await expect(assertNumberSlot(B.tenant.id, B.number)).resolves.toBeUndefined(); // bestehende Nummer bearbeiten
      await expect(assertNumberSlot(B.tenant.id, "+493099999999")).rejects.toThrow(/1 Rufnummer/);

      // Ohne „Eigene Begrüßung & FAQ“: Standardbegrüßung
      const cfg = { ...B.cfg, settings: { ...B.cfg.settings, greeting: "Moin bei Beta!", faq: "Preise auf Anfrage" } };
      const limited = applyPlanToConfig(cfg, effectivePlan(B.tenant, plan));
      expect(limited.settings.greeting).toBe("");
      expect(limited.settings.faq).toBe("");

      // Ohne Terminbuchung: keine Slots, Termin wird nicht eingetragen; ohne Notfall-Durchstellung keine Nummer
      await prisma.employee.update({ where: { id: B.tech.id }, data: { directPhone: "+4915111111111" } });
      await prisma.call.create({ data: { tenantId: B.tenant.id, providerCallId: "retell-plan", fromNumber: "+4915000000080", toNumber: B.number } });
      const ctx = (await resolveVoiceContext("retell-plan", null, null))!;
      const tech = (await runTool("find_technician", { description: "Heizung tropft", category: "Heizung" }, ctx)) as { slots: unknown[]; say: string };
      expect(tech.slots).toEqual([]);
      expect(tech.say).toContain("Rückruf zur Terminabstimmung");
      const booked = (await runTool("book_appointment", { description: "Heizung tropft", category: "Heizung", appointmentStart: new Date(Date.now() + 86400_000).toISOString() }, ctx)) as { appointment: string | null };
      expect(booked.appointment).toBeNull();
      const sos = (await runTool("escalate_emergency", { description: "Wasserrohrbruch", category: "Rohrbruch" }, ctx)) as { transferNumber: string | null };
      expect(sos.transferNumber).toBeNull();
      await settleDeferred();
    } finally {
      await prisma.tenant.update({ where: { id: B.tenant.id }, data: { planId: null } });
    }
  });

  it("erinnert Kunden einmal vor dem Termin, aber nicht bei kurzfristig gebuchten Terminen", async () => {
    const settings = { ...(A.tenant.settings as object), notifications: { reminder: "email", reminderHoursBefore: 24, contactPhone: "030 1234567" } };
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { settings } });
    const cust = await prisma.customer.create({ data: { tenantId: A.tenant.id, phone: "+4915000000090", name: "Erika Muster", email: "erika@example.org" } });
    const old = new Date(Date.now() - 2 * 86400_000);
    const at = (h: number) => new Date(Date.now() + h * 3600_000);
    const mk = (start: Date, created: Date) => prisma.callTicket.create({ data: { tenantId: A.tenant.id, customerId: cust.id, assignedEmployeeId: A.tech.id, category: "Wespen", appointmentStart: start, appointmentEnd: new Date(start.getTime() + 3600_000), createdAt: created, updatedAt: created } });
    const due = await mk(at(20), old);
    const shortNotice = await mk(at(10), new Date());
    const later = await mk(at(40), old);
    try {
      const r = await runAppointmentReminders();
      expect(r.sent).toBe(1);
      const msgs = await prisma.message.findMany({ where: { purpose: "APPOINTMENT_REMINDER" } });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({ ticketId: due.id, recipient: "erika@example.org" });
      expect(msgs[0].body).toContain("030 1234567");
      expect((await prisma.callTicket.findUnique({ where: { id: shortNotice.id } }))?.reminderSentAt).not.toBeNull(); // übersprungen
      expect((await prisma.callTicket.findUnique({ where: { id: later.id } }))?.reminderSentAt).toBeNull(); // noch nicht fällig
      await runAppointmentReminders();
      expect(await prisma.message.count({ where: { purpose: "APPOINTMENT_REMINDER" } })).toBe(1);
    } finally {
      await prisma.tenant.update({ where: { id: A.tenant.id }, data: { settings: A.tenant.settings as object } });
    }
  });

  it("verschiebt und sagt Termine per Telefon ab – nur für die verifizierte Anrufernummer", async () => {
    const phone = "+4915000000095";
    const cust = await prisma.customer.create({ data: { tenantId: A.tenant.id, phone, name: "Paul Termin" } });
    const { slots } = await findAvailableSlots(A.tenant, A.cfg, A.tech);
    const t = await prisma.callTicket.create({ data: { tenantId: A.tenant.id, customerId: cust.id, assignedEmployeeId: A.tech.id, category: "Ratten", status: "PROCESSED", appointmentStart: slots[0].start, appointmentEnd: slots[0].end, reminderSentAt: new Date() } });
    const ref = t.id.slice(-8).toUpperCase();

    // Fremder Anrufer nennt die Vorgangsnummer → nichts
    await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-other", fromNumber: "+4915000000096", toNumber: A.number } });
    const other = (await resolveVoiceContext("retell-other", null, null))!;
    expect(((await runTool("find_appointments", {}, other)) as { found: boolean }).found).toBe(false);
    expect(((await runTool("cancel_appointment", { reference: ref }, other)) as { ok?: boolean }).ok).toBeUndefined();
    expect((await prisma.callTicket.findUnique({ where: { id: t.id } }))?.status).toBe("PROCESSED");

    // Kunde selbst
    await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-self", fromNumber: phone, toNumber: A.number } });
    const self = (await resolveVoiceContext("retell-self", null, null))!;
    const found = (await runTool("find_appointments", {}, self)) as { appointments: { reference: string }[] };
    expect(found.appointments.map((a) => a.reference)).toEqual([ref]);
    const offer = (await runTool("reschedule_appointment", {}, self)) as { slots: { start: string }[] };
    expect(offer.slots.length).toBeGreaterThan(0);
    const target = offer.slots.find((s) => s.start !== slots[0].start.toISOString())!;
    const moved = (await runTool("reschedule_appointment", { reference: ref, appointmentStart: target.start }, self)) as { ok: boolean };
    expect(moved.ok).toBe(true);
    let row = (await prisma.callTicket.findUnique({ where: { id: t.id } }))!;
    expect(row.appointmentStart?.toISOString()).toBe(target.start);
    expect(row.reminderSentAt).toBeNull(); // neue Erinnerung für den neuen Termin
    expect(row.notes).toContain("verschoben");

    const cancelled = (await runTool("cancel_appointment", { reference: ref, reason: "Problem hat sich erledigt" }, self)) as { ok: boolean };
    expect(cancelled.ok).toBe(true);
    await settleDeferred();
    row = (await prisma.callTicket.findUnique({ where: { id: t.id } }))!;
    expect(row).toMatchObject({ status: "CLOSED", appointmentStart: null });
    expect(row.notes).toContain("abgesagt: Problem hat sich erledigt");
  });

  it("zählt sicherheitsrelevante Limits gemeinsam in der Datenbank", async () => {
    const l = { limit: 3, windowMs: 60_000 };
    const t0 = Math.floor(Date.now() / 60_000) * 60_000 + 1000;
    expect(await hitShared("login:ip:203.0.113.7", l, t0)).toBe(0);
    expect(await hitShared("login:ip:203.0.113.7", l, t0 + 1)).toBe(0);
    expect(await hitShared("login:ip:203.0.113.7", l, t0 + 2)).toBe(0);
    expect(await hitShared("login:ip:203.0.113.7", l, t0 + 3)).toBeGreaterThan(0);
    expect(await hitShared("login:ip:203.0.113.8", l, t0 + 3)).toBe(0); // andere IP
    // Schlüssel wird nicht im Klartext gespeichert
    expect(await prisma.rateLimitHit.count({ where: { key: { contains: "203.0.113" } } })).toBe(0);
    // nächstes Fenster: Vorfenster zählt anteilig weiter
    expect(await hitShared("login:ip:203.0.113.7", l, t0 + 60_000)).toBeGreaterThan(0);
    expect(await hitShared("login:ip:203.0.113.7", l, t0 + 119_000)).toBe(0);
  });

  it("verschlüsselt nach einem Schlüsselwechsel alle Geheimnisse neu", async () => {
    const before = { cur: process.env.APP_ENCRYPTION_KEY, old: process.env.APP_ENCRYPTION_KEYS_OLD };
    process.env.APP_ENCRYPTION_KEY = "1".repeat(64);
    try {
      const u = await prisma.user.create({ data: { email: "rekey@example.org", role: "TENANT_USER", tenantId: A.tenant.id, totpSecretEnc: seal("JBSWY3DPEHPK3PXP") } });
      await prisma.platformSetting.upsert({ where: { key: "SMTP_PASS" }, create: { key: "SMTP_PASS", value: seal("smtp-geheim"), secret: true }, update: { value: seal("smtp-geheim"), secret: true } });
      process.env.APP_ENCRYPTION_KEY = "2".repeat(64);
      process.env.APP_ENCRYPTION_KEYS_OLD = "1".repeat(64);
      const r = await resealAll();
      expect(r).toMatchObject({ failed: 0, remaining: 0 });
      expect(r.resealed).toBeGreaterThanOrEqual(2);
      delete process.env.APP_ENCRYPTION_KEYS_OLD; // alter Schlüssel kann weg
      expect(unseal((await prisma.user.findUnique({ where: { id: u.id } }))!.totpSecretEnc!)).toBe("JBSWY3DPEHPK3PXP");
      expect(unseal((await prisma.platformSetting.findUnique({ where: { key: "SMTP_PASS" } }))!.value)).toBe("smtp-geheim");
    } finally {
      await prisma.platformSetting.deleteMany({ where: { key: "SMTP_PASS" } });
      if (before.cur) process.env.APP_ENCRYPTION_KEY = before.cur; else delete process.env.APP_ENCRYPTION_KEY;
      if (before.old) process.env.APP_ENCRYPTION_KEYS_OLD = before.old; else delete process.env.APP_ENCRYPTION_KEYS_OLD;
    }
  });

  it("hält die Einwilligung zur Aufzeichnung fest und löscht die Aufnahme ohne Einwilligung", async () => {
    const ask = { ...(A.tenant.settings as object), recordingConsent: "ask" };
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { settings: ask } });
    try {
      for (const [id, granted] of [["retell-yes", true], ["retell-no", false], ["retell-silent", null]] as const) {
        await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: id, fromNumber: "+4915000000097", toNumber: A.number, status: "IN_PROGRESS" } });
        if (granted !== null) {
          const ctx = (await resolveVoiceContext(id, null, null))!;
          await runTool("recording_consent", { granted }, ctx);
        }
        await handleCallEvent({ provider: "retell", kind: "ended", callId: id, fromNumber: null, toNumber: null, transcript: "Agent: Hallo", summary: null, durationSec: 30, recordingUrl: `https://api.twilio.com/rec/${id}`, endReason: "user_hangup" });
      }
      await settleDeferred();
      const rows = Object.fromEntries((await prisma.call.findMany({ where: { providerCallId: { in: ["retell-yes", "retell-no", "retell-silent"] } } })).map((c) => [c.providerCallId, c]));
      expect(rows["retell-yes"]).toMatchObject({ recordingConsent: "GRANTED", recordingUrl: "https://api.twilio.com/rec/retell-yes" });
      expect(rows["retell-no"]).toMatchObject({ recordingConsent: "DENIED", recordingUrl: null });
      expect(rows["retell-silent"]).toMatchObject({ recordingConsent: null, recordingUrl: null }); // ohne klare Antwort keine Aufnahme
      expect(rows["retell-no"].transcript).toBe("Agent: Hallo"); // Mitschrift bleibt für den Vorgang
    } finally {
      await prisma.tenant.update({ where: { id: A.tenant.id }, data: { settings: A.tenant.settings as object } });
    }
  });

  it("respektiert SMS-Abbestellung (STOP) und Einwilligung", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32), TWILIO_AUTH_TOKEN: "t", TWILIO_SMS_FROM: "+4930000000" });
    resetEnvCache();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: 21610, message: "Attempt to send to unsubscribed recipient" }), { status: 400 }));
    try {
      const cust = await prisma.customer.create({ data: { tenantId: A.tenant.id, phone: "+4915000000098" } });
      const { sendSms } = await import("@/lib/notify");
      const r = await sendSms({ tenantId: A.tenant.id, to: cust.phone, body: "Test", purpose: "CUSTOMER_CONFIRMATION" });
      expect(r.status).toBe("SKIPPED");
      expect((await prisma.message.findUnique({ where: { id: r.id } }))?.nextAttemptAt).toBeNull(); // keine Wiederholung
      expect((await prisma.customer.findUnique({ where: { id: cust.id } }))?.smsOptOutAt).not.toBeNull();

      // Einwilligung am Telefon (nur verifizierte Nummer) setzt den Widerspruch zurück
      await prisma.call.create({ data: { tenantId: A.tenant.id, providerCallId: "retell-sms", fromNumber: cust.phone, toNumber: A.number } });
      await runTool("save_customer", { smsConsent: true }, (await resolveVoiceContext("retell-sms", null, null))!);
      const c = (await prisma.customer.findUnique({ where: { id: cust.id } }))!;
      expect(c.smsConsentAt).not.toBeNull();
      expect(c.smsConsentSource).toMatch(/^call:/);
      expect(c.smsOptOutAt).toBeNull();
    } finally {
      fetchMock.mockRestore();
      for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"]) delete process.env[k];
      resetEnvCache();
    }
  });

  it("schreibt Monate fest, bevor Anrufdaten verschwinden (GoBD), und anonymisiert statt zu löschen", async () => {
    const tz = A.tenant.timezone;
    const cur = currentMonth(tz);
    const prev = cur.month === 1 ? { year: cur.year - 1, month: 12 } : { year: cur.year, month: cur.month - 1 };
    const inPrev = new Date(monthRange(prev.year, prev.month, tz).start.getTime() + 2 * 86400_000);
    await prisma.call.create({ data: { tenantId: A.tenant.id, fromNumber: "+4915000000110", toNumber: A.number, status: "ENDED", startedAt: inPrev, endedAt: inPrev, durationSec: 600, providerPurgedAt: new Date() } });
    const before = await usageForMonth(A.tenant, prev.year, prev.month, 60);
    const now = new Date(monthRange(cur.year, cur.month, tz).start.getTime() + 4 * 86400_000); // 5. des Monats
    await closeDueMonths(A.tenant.id, now);
    const snap = await prisma.billingSnapshot.findUnique({ where: { tenantId_year_month: { tenantId: A.tenant.id, ...prev } } });
    expect(snap?.partial).toBe(false);
    // Anrufe des abgeschlossenen Monats löschen → Abrechnung bleibt gleich
    await prisma.call.deleteMany({ where: { tenantId: A.tenant.id, startedAt: { lt: monthRange(cur.year, cur.month, tz).start } } });
    expect((await usageForMonth(A.tenant, prev.year, prev.month, 60)).minutes).toBe(before.minutes);
    // Export für die Buchhaltung: festgeschriebene Werte, auch für gelöschte Kunden
    await prisma.billingSnapshot.create({ data: { tenantId: "geloeschter-kunde", tenantName: "Ehemals GmbH", year: prev.year, month: prev.month, planName: "Mini", usage: { calls: 1, seconds: 60, minutes: 1, sms: 0, emails: 0, tickets: 0, emergencies: 0 }, invoice: { lines: [], netCents: 4900, vatPercent: 19, vatCents: 931, grossCents: 5831, overageMinutes: 0, overageSms: 0 } } });
    const report = await billingReport(prev.year, prev.month);
    expect(report.find((r) => r.tenantId === A.tenant.id)?.closed).toBe(true);
    expect(report.find((r) => r.tenantId === "geloeschter-kunde")).toMatchObject({ status: "DELETED", closed: true, tenantName: "Ehemals GmbH" });
    expect(billingCsv(report, "x")).toContain("Ehemals GmbH;DELETED;ja;Mini");

    // DSGVO-Löschung eines Anrufers im laufenden Monat: Minuten bleiben, Personenbezug weg
    const cust = await prisma.customer.create({ data: { tenantId: A.tenant.id, phone: "+4915000000111", name: "Lösch Mich" } });
    await prisma.call.create({ data: { tenantId: A.tenant.id, customerId: cust.id, fromNumber: cust.phone, toNumber: A.number, status: "ENDED", endedAt: new Date(), durationSec: 300, transcript: "User: Hallo" } });
    const liveBefore = await usageForMonth(A.tenant, cur.year, cur.month, 60);
    await eraseCustomer(A.tenant.id, cust.id);
    const liveAfter = await usageForMonth(A.tenant, cur.year, cur.month, 60);
    expect(liveAfter.minutes).toBe(liveBefore.minutes);
    expect(await prisma.call.count({ where: { fromNumber: cust.phone } })).toBe(0);
    expect(await prisma.call.count({ where: { tenantId: A.tenant.id, fromNumber: "gelöscht", transcript: null } })).toBeGreaterThan(0);
  });

  it("löscht einen Mandanten nur nach Anbieter-Löschung (oder ausdrücklich erzwungen) und lässt andere unberührt", async () => {
    const before = await prisma.call.count({ where: { tenantId: A.tenant.id } });
    // Ohne Retell-Schlüssel scheitert die Anbieter-Löschung → Abbruch ohne force
    expect(await deleteTenant(B.tenant.id)).toEqual({ deleted: false, providerFailed: expect.any(Number) });
    expect(await prisma.tenant.findUnique({ where: { id: B.tenant.id } })).not.toBeNull();
    const r = await deleteTenant(B.tenant.id, { force: true });
    expect(r.deleted).toBe(true);
    expect(await prisma.tenant.findUnique({ where: { id: B.tenant.id } })).toBeNull();
    expect(await prisma.billingSnapshot.count({ where: { tenantId: B.tenant.id, partial: true } })).toBe(1); // Schlussabrechnung bleibt
    expect(await prisma.call.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.customer.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.phoneNumber.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.call.count({ where: { tenantId: A.tenant.id } })).toBe(before);
  });
});
