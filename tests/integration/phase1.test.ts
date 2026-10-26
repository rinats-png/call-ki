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
