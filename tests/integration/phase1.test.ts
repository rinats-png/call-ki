import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveConfig } from "@/lib/tenant/settings";
import { processServiceRequest } from "@/lib/services/tickets";
import { settleDeferred } from "@/lib/defer";

/**
 * Integrationstests Phase 1 (Leistungskatalog, Einsatz, Rechnung, Kundenkontakt).
 * Eigene Mandanten mit eindeutigen Slugs; keine globalen TRUNCATEs.
 */
const enabled = !!process.env.TEST_DATABASE_URL;
const uid = Math.random().toString(36).slice(2, 8);

describe.skipIf(!enabled)("Phase 1 – Leistungskatalog & Gewerke", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Sanitär P1 ${uid}`, slug: `p1-${uid}`, industry: "trades", status: "ACTIVE", settings: { appointments: { leadMin: 0, bufferMin: 0 } } } });
  });
  afterAll(async () => {
    await settleDeferred();
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  });

  it("bucht mit der Dauer der Leistung und wählt den Mitarbeiter mit passendem Gewerk", async () => {
    const heiz = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Hanna Heizung", role: "FIELD_TECH", servicePostalCodes: "55124", trades: "Heizung" } });
    const sani = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Emre Sanitär", role: "FIELD_TECH", servicePostalCodes: "55", trades: "Sanitär" } });
    const svc = await prisma.service.create({ data: { tenantId: tenant.id, name: "Rohrbruch", aliases: "Wasserschaden, Leck", trade: "Sanitär", durationMin: 90, priceCents: 8900 } });
    const start = new Date(Date.now() + 3 * 86400_000);
    start.setUTCHours(8, 0, 0, 0);
    const r = await processServiceRequest(tenant, resolveConfig(tenant), {
      customer: { phone: "+4915112345001", name: "Jonas Weber", postalCode: "55124" },
      category: "Wasserschaden", description: "Wasser unter der Spüle", appointmentStart: start,
    });
    expect(r.ticket.serviceId).toBe(svc.id);
    expect(r.ticket.assignedEmployeeId).toBe(sani.id);
    expect(r.ticket.assignedEmployeeId).not.toBe(heiz.id);
    expect(r.appointment && (r.appointment.end.getTime() - r.appointment.start.getTime()) / 60000).toBe(90);
    expect(r.routing.reason).toContain("Gewerk: Sanitär");
  });

  it("nutzt ohne passende Leistung die Standarddauer und lässt serviceId leer", async () => {
    const start = new Date(Date.now() + 4 * 86400_000);
    start.setUTCHours(9, 0, 0, 0);
    const cfg = resolveConfig(tenant);
    const r = await processServiceRequest(tenant, cfg, { customer: { phone: "+4915112345002", postalCode: "55124" }, category: "Sonstiges", description: "Frage", appointmentStart: start });
    expect(r.ticket.serviceId).toBeNull();
    if (r.appointment) expect((r.appointment.end.getTime() - r.appointment.start.getTime()) / 60000).toBe(cfg.durationMin);
  });
});

describe.skipIf(!enabled)("Phase 1 – Endkunden-Rechnungen", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  let customerId: string;
  const line = { description: "Rohrbruch beheben", quantity: 1, unit: "pauschal", unitCents: 8900, taxRate: 19 };
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Rechnung P1 ${uid}`, slug: `p1b-${uid}`, industry: "trades", status: "ACTIVE", settings: { invoicing: { address: "Gartenstraße 8, 55116 Mainz", taxNumber: "26/123/45678", iban: "DE89370400440532013000" } } } });
    customerId = (await prisma.customer.create({ data: { tenantId: tenant.id, phone: "+4915112345101", name: "Jonas Weber", address: "Am Rhein 3, 55116 Mainz" } })).id;
  });
  afterAll(async () => {
    await prisma.bill.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("stellt fortlaufend nummeriert aus, friert ein und storniert per Gutschrift", async () => {
    const { createDraft, issueBill, updateDraft, cancelInvoice } = await import("@/lib/services/bills");
    const a = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "INVOICE", customerId, lines: [line] })).id);
    const b = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "INVOICE", customerId, lines: [line, { ...line, description: "Material", unitCents: 1000 }] })).id);
    const y = new Date().getUTCFullYear();
    expect(a.number).toBe(`RE-${y}-0001`);
    expect(b.number).toBe(`RE-${y}-0002`);
    expect(a.grossCents).toBe(10591);
    expect((a.recipient as { address: string }).address).toContain("Am Rhein 3");
    await expect(updateDraft(tenant.id, a.id, { note: "x" })).rejects.toMatchObject({ status: 409 });
    // spätere Änderungen am Kunden ändern den ausgestellten Beleg nicht
    await prisma.customer.update({ where: { id: customerId }, data: { address: "Neue Straße 1" } });
    expect(((await prisma.bill.findUniqueOrThrow({ where: { id: a.id } })).recipient as { address: string }).address).toContain("Am Rhein 3");
    const credit = await cancelInvoice(tenant.id, a.id, "Doppelt");
    expect(credit.number).toBe(`GS-${y}-0001`);
    expect(credit.grossCents).toBe(-10591);
    expect(credit.relatedId).toBe(a.id);
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("CANCELLED");
    await expect(cancelInvoice(tenant.id, a.id, "")).rejects.toMatchObject({ status: 409 });
  });

  it("verweigert das Ausstellen ohne Pflichtangaben und Kundenanschrift", async () => {
    const { createDraft, issueBill } = await import("@/lib/services/bills");
    const bare = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "+4915112345102" } });
    const d = await createDraft(tenant.id, { kind: "INVOICE", customerId: bare.id, lines: [line] });
    await expect(issueBill(tenant.id, d.id)).rejects.toMatchObject({ status: 400 });
    // Angebote gehen auch ohne Anschrift
    const q = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "QUOTE", customerId: bare.id, lines: [line] })).id);
    expect(q.number).toMatch(/^AN-/);
  });

  it("macht aus einem Angebot einen Rechnungsentwurf", async () => {
    const { createDraft, issueBill, convertQuote } = await import("@/lib/services/bills");
    const q = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "QUOTE", customerId, lines: [line] })).id);
    const inv = await convertQuote(tenant.id, q.id);
    expect(inv.kind).toBe("INVOICE");
    expect(inv.status).toBe("DRAFT");
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: inv.id } })).relatedId).toBe(q.id);
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("ACCEPTED");
  });

  it("Löschanfrage: Entwürfe weg, Kunde mit ausgestellten Belegen anonymisiert", async () => {
    const { createDraft } = await import("@/lib/services/bills");
    const { eraseCustomer } = await import("@/lib/services/customers");
    await createDraft(tenant.id, { kind: "INVOICE", customerId, lines: [line] });
    expect(await eraseCustomer(tenant.id, customerId)).toBeTruthy();
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    expect(c?.phone).toMatch(/^geloescht:/);
    expect(c?.address).toBeFalsy();
    expect(await prisma.bill.count({ where: { tenantId: tenant.id, customerId, status: "DRAFT" } })).toBe(0);
    expect(await prisma.bill.count({ where: { tenantId: tenant.id, customerId } })).toBeGreaterThan(0);
  });
});
