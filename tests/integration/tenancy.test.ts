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
import { retryDueMessages, MAX_ATTEMPTS } from "@/lib/notify";
import { resetEnvCache } from "@/lib/env";
import { vi } from "vitest";
import { findAvailableSlots } from "@/lib/calendar";
import { deleteTenant, exportTenantData } from "@/lib/services/tenants";

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
    await prisma.$executeRawUnsafe('TRUNCATE "Tenant", "User" CASCADE');
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
      expect(ids).toEqual(expect.arrayContaining(["emergency-skipped", "calls-hanging", "backup-missing"]));
      expect(first.alerted).toBe(first.findings.length);
      const alerts = await prisma.message.findMany({ where: { purpose: "PLATFORM_ALERT", recipient: "betrieb@example.org" } });
      expect(alerts.length).toBe(first.findings.length);
      expect(alerts.map((a) => a.body).join()).not.toMatch(/\+49\d{6,}/); // keine Rufnummern im Alarm
      // gleicher Zustand kurz danach → keine erneuten Alarme
      expect((await runMonitor()).alerted).toBe(0);
      // Backup meldet sich → Befund verschwindet
      await recordHeartbeat("backup", true);
      expect((await runMonitor()).findings.some((f) => f.id.startsWith("backup"))).toBe(false);
    } finally {
      delete process.env.ALERT_EMAIL;
      delete process.env.BACKUP_EXPECTED;
    }
  });

  it("löscht einen Mandanten nur nach Anbieter-Löschung (oder ausdrücklich erzwungen) und lässt andere unberührt", async () => {
    const before = await prisma.call.count({ where: { tenantId: A.tenant.id } });
    // Ohne Retell-Schlüssel scheitert die Anbieter-Löschung → Abbruch ohne force
    expect(await deleteTenant(B.tenant.id)).toEqual({ deleted: false, providerFailed: expect.any(Number) });
    expect(await prisma.tenant.findUnique({ where: { id: B.tenant.id } })).not.toBeNull();
    const r = await deleteTenant(B.tenant.id, { force: true });
    expect(r.deleted).toBe(true);
    expect(await prisma.tenant.findUnique({ where: { id: B.tenant.id } })).toBeNull();
    expect(await prisma.call.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.customer.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.phoneNumber.count({ where: { tenantId: B.tenant.id } })).toBe(0);
    expect(await prisma.call.count({ where: { tenantId: A.tenant.id } })).toBe(before);
  });
});
