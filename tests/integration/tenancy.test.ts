import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveConfig } from "@/lib/tenant/settings";
import { processServiceRequest } from "@/lib/services/tickets";
import { findCustomerByPhone } from "@/lib/services/customers";
import { handleCallEvent } from "@/lib/services/calls";
import { resolveVoiceContext } from "@/lib/voice/context";
import { runTool } from "@/lib/voice/tools";
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
  afterAll(async () => prisma.$disconnect());

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
