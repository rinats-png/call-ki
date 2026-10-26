import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveConfig } from "@/lib/tenant/settings";
import { processServiceRequest } from "@/lib/services/tickets";
import { settleDeferred } from "@/lib/defer";
import crypto from "node:crypto";

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

describe.skipIf(!enabled)("Phase 1 – Techniker-App & Einsatzbericht", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  let tech: { id: string; tenantId: string };
  let other: { id: string; tenantId: string };
  let ticketId: string;
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Technik P1 ${uid}`, slug: `p1t-${uid}`, industry: "trades", status: "ACTIVE", settings: { jobs: { hourlyRateCents: 6800 } }, addons: { create: [{ key: "field_app", priceCents: 2900 }, { key: "invoicing", priceCents: 1900 }] } } });
    tech = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Emre Yilmaz", role: "FIELD_TECH" } });
    other = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Hanna Berg", role: "FIELD_TECH" } });
    const customer = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "+4915112345201", name: "Jonas Weber", address: "Am Rhein 3, 55116 Mainz" } });
    const service = await prisma.service.create({ data: { tenantId: tenant.id, name: "Rohrbruch", priceCents: 8900 } });
    const start = new Date(Date.now() + 2 * 3600_000);
    ticketId = (await prisma.callTicket.create({ data: { tenantId: tenant.id, customerId: customer.id, assignedEmployeeId: tech.id, serviceId: service.id, category: "Rohrbruch", appointmentStart: start, appointmentEnd: new Date(start.getTime() + 3600_000), status: "PROCESSED" } })).id;
  });
  afterAll(async () => {
    await prisma.bill.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.callTicket.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("Geräte-Link: nur der aktuelle gilt, Sperren wirkt sofort", async () => {
    const { issueAppToken, employeeForToken, revokeAppToken } = await import("@/lib/services/jobs");
    const t1 = await issueAppToken(tenant.id, tech.id);
    expect((await employeeForToken(t1)).id).toBe(tech.id);
    const t2 = await issueAppToken(tenant.id, tech.id);
    await expect(employeeForToken(t1)).rejects.toMatchObject({ status: 404 });
    expect((await employeeForToken(t2)).id).toBe(tech.id);
    // Hash wird nicht mit den Mitarbeiterdaten geladen
    expect(Object.keys(await prisma.employee.findUniqueOrThrow({ where: { id: tech.id } }))).not.toContain("appTokenHash");
    await revokeAppToken(tenant.id, tech.id);
    await expect(employeeForToken(t2)).rejects.toMatchObject({ status: 404 });
    await expect(issueAppToken("fremd", tech.id)).rejects.toMatchObject({ status: 404 });
  });

  it("Ablauf: Liste → unterwegs → vor Ort → Bericht, Foto → Abschluss mit Rechnungsentwurf", async () => {
    const j = await import("@/lib/services/jobs");
    const list = await j.jobsFor(tech);
    expect(list.map((x) => x.id)).toContain(ticketId);
    expect((await j.jobsFor(other)).map((x) => x.id)).not.toContain(ticketId);
    await expect(j.updateJob(other, ticketId, { findings: "x" })).rejects.toMatchObject({ status: 404 });

    expect((await j.setJobStatus(tech, ticketId, "EN_ROUTE")).firstTime).toBe(true);
    expect((await j.setJobStatus(tech, ticketId, "EN_ROUTE")).firstTime).toBe(false);
    await j.setJobStatus(tech, ticketId, "ON_SITE");
    await expect(j.finishJob(tech, ticketId, {})).rejects.toMatchObject({ status: 400 });
    await j.updateJob(tech, ticketId, { findings: "Eckventil undicht", workDone: "Eckventil getauscht", hoursWorked: 1.4, materials: [{ description: "Eckventil", quantity: 1, unit: "Stück", unitCents: 1250 }] });
    await expect(j.addPhoto(tech, ticketId, "image/png", JPEG)).rejects.toMatchObject({ status: 415 });
    await j.addPhoto(tech, ticketId, "image/jpeg", JPEG);

    const r = await j.finishJob(tech, ticketId, { signatureName: "J. Weber", signaturePng: Buffer.from("89504e470d0a1a0a00", "hex") });
    expect(r.billId).toBeTruthy();
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: r.billId! } });
    expect(bill.status).toBe("DRAFT");
    expect(bill.ticketId).toBe(ticketId);
    expect((bill.lines as { description: string; quantity: number }[]).map((l) => `${l.quantity} ${l.description}`)).toEqual(["1 Rohrbruch", "1.5 Arbeitszeit", "1 Eckventil"]);
    const rep = await prisma.jobReport.findUniqueOrThrow({ where: { ticketId }, include: { photos: true } });
    expect(rep).toMatchObject({ status: "DONE", signatureName: "J. Weber", hoursWorked: 1.5 });
    expect(rep.photos).toHaveLength(1);
    expect(rep.enRouteAt && rep.arrivedAt && rep.finishedAt).toBeTruthy();
    expect((await prisma.callTicket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe("CLOSED");
    // Erledigt bleibt in der Liste sichtbar, ist aber gesperrt
    expect((await j.jobsFor(tech)).map((x) => x.id)).toContain(ticketId);
    await expect(j.updateJob(tech, ticketId, { findings: "y" })).rejects.toMatchObject({ status: 409 });
    await expect(j.finishJob(tech, ticketId, {})).rejects.toMatchObject({ status: 409 });
  });
});

describe.skipIf(!enabled)("Phase 1 – Kundenkontakt", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  let tech: { id: string; tenantId: string; name: string };
  const phone = "+4915112345301";
  let customerId: string;
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Kontakt P1 ${uid}`, slug: `p1k-${uid}`, industry: "trades", status: "ACTIVE", settings: { notifications: { backofficeEmail: "buero@example.org", contactPhone: "06131 123456" }, contact: { enRoute: "both", reviewRequest: "both", reviewUrl: "https://g.page/r/test", reviewDelayHours: 2 } }, addons: { create: [{ key: "customer_contact", priceCents: 900 }] } } });
    tech = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Emre Yilmaz", role: "FIELD_TECH" } });
    customerId = (await prisma.customer.create({ data: { tenantId: tenant.id, phone, name: "Jonas Weber", email: "jonas@example.org" } })).id;
  });
  afterAll(async () => {
    await prisma.message.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.callTicket.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });
  const mkTicket = (h: number) => {
    const start = new Date(Date.now() + h * 3600_000);
    return prisma.callTicket.create({ data: { tenantId: tenant.id, customerId, assignedEmployeeId: tech.id, category: "Rohrbruch", status: "PROCESSED", appointmentStart: start, appointmentEnd: new Date(start.getTime() + 3600_000) } });
  };
  const remind = (ticketId: string) => prisma.message.create({ data: { tenantId: tenant.id, ticketId, channel: "SMS", recipient: phone, body: "Erinnerung … Passt es noch?", purpose: "APPOINTMENT_REMINDER", status: "SENT" } });

  it("JA bestätigt den Termin, NEIN eskaliert und meldet ans Büro", async () => {
    const { handleInboundSms } = await import("@/lib/services/sms-replies");
    const a = await mkTicket(20);
    await remind(a.id);
    expect(await handleInboundSms("0151 12345301", "Ja, passt")).toMatchObject({ intent: "YES", matched: true, ticketId: a.id });
    expect((await prisma.callTicket.findUniqueOrThrow({ where: { id: a.id } })).confirmation).toBe("CONFIRMED");

    const b = await mkTicket(30);
    await remind(b.id);
    await handleInboundSms(phone, "Nein, bin krank");
    const tb = await prisma.callTicket.findUniqueOrThrow({ where: { id: b.id } });
    expect(tb).toMatchObject({ confirmation: "DECLINED", status: "ESCALATED" });
    expect(tb.notes).toContain("bin krank");
    expect(await prisma.message.count({ where: { ticketId: b.id, channel: "EMAIL", recipient: "buero@example.org" } })).toBe(1);
    expect((await prisma.message.findFirstOrThrow({ where: { ticketId: b.id, channel: "SMS", purpose: "JOB_UPDATE" } })).body).toContain("06131 123456");

    // Unbekannte Nummer → keine Zuordnung
    expect(await handleInboundSms("+4915199999999", "Ja")).toMatchObject({ matched: false });
    // STOP → Widerspruch
    await handleInboundSms(phone, "STOP");
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).smsOptOutAt).not.toBeNull();
    await prisma.customer.update({ where: { id: customerId }, data: { smsOptOutAt: null } });
  });

  it("„Unterwegs“ geht einmal raus, Bewertung nach Verzögerung und höchstens alle 90 Tage", async () => {
    const { onJobEnRoute, runReviewRequests } = await import("@/lib/services/job-contact");
    const t = await mkTicket(1);
    expect((await onJobEnRoute(tenant.id, t.id, tech.name)).sent).toBe(true);
    const enRoute = await prisma.message.findMany({ where: { ticketId: t.id, purpose: "JOB_UPDATE" } });
    expect(enRoute.map((m) => m.channel).sort()).toEqual(["EMAIL", "SMS"]);
    expect(enRoute.find((m) => m.channel === "SMS")!.body).toContain("Emre ist jetzt unterwegs");

    const now = new Date();
    await prisma.callTicket.update({ where: { id: t.id }, data: { status: "CLOSED", closedAt: new Date(now.getTime() - 3600_000) } });
    await runReviewRequests(now);
    expect(await prisma.message.count({ where: { ticketId: t.id, purpose: "REVIEW_REQUEST" } })).toBe(0); // noch zu früh
    await runReviewRequests(new Date(now.getTime() + 2 * 3600_000));
    expect(await prisma.message.count({ where: { ticketId: t.id, purpose: "REVIEW_REQUEST" } })).toBe(2);
    await runReviewRequests(new Date(now.getTime() + 3 * 3600_000));
    expect(await prisma.message.count({ where: { ticketId: t.id, purpose: "REVIEW_REQUEST" } })).toBe(2);

    // zweiter Einsatz kurz danach: keine erneute Bitte (90 Tage)
    const t2 = await mkTicket(2);
    await prisma.callTicket.update({ where: { id: t2.id }, data: { status: "CLOSED", closedAt: now } });
    await runReviewRequests(new Date(now.getTime() + 3 * 3600_000));
    expect(await prisma.message.count({ where: { ticketId: t2.id, purpose: "REVIEW_REQUEST" } })).toBe(0);
    expect((await prisma.callTicket.findUniqueOrThrow({ where: { id: t2.id } })).reviewHandledAt).not.toBeNull();
    // Abgesagter Termin (ohne closedAt) löst keine Bitte aus
    const t3 = await mkTicket(3);
    await prisma.callTicket.update({ where: { id: t3.id }, data: { status: "CLOSED", appointmentStart: null } });
    await prisma.customer.update({ where: { id: customerId }, data: { reviewRequestedAt: null } });
    await runReviewRequests(new Date(now.getTime() + 4 * 3600_000));
    expect(await prisma.message.count({ where: { ticketId: t3.id, purpose: "REVIEW_REQUEST" } })).toBe(0);
  });
});

describe.skipIf(!enabled)("Zusatzoptionen", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Addon ${uid}`, slug: `p1a-${uid}`, industry: "trades", status: "ACTIVE", timezone: "Europe/Berlin" } });
  });
  afterAll(async () => {
    await prisma.addonPrice.deleteMany({});
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("ohne Buchung gesperrt, nach Buchung sofort aktiv, Kündigung zum Monatsende", async () => {
    const a = await import("@/lib/addons");
    expect(await a.activeModules(tenant.id)).toEqual([]);
    await expect(a.requireModule(tenant.id, "invoicing")).rejects.toMatchObject({ status: 403 });
    const now = new Date("2026-10-26T10:00:00Z");
    await a.bookAddon(tenant.id, "invoicing", {}, now);
    expect(await a.activeModules(tenant.id, now)).toEqual(["invoicing"]);
    await expect(a.bookAddon(tenant.id, "invoicing", {}, now)).rejects.toMatchObject({ status: 409 });
    const c = await a.cancelAddon(tenant.id, "invoicing", {}, now);
    expect(c.endsAt!.toISOString()).toBe("2026-10-31T23:00:00.000Z"); // 1.11. 00:00 Berlin
    expect(await a.hasModule(tenant.id, "invoicing", new Date("2026-10-31T22:59:00Z"))).toBe(true);
    expect(await a.hasModule(tenant.id, "invoicing", new Date("2026-11-01T00:00:00Z"))).toBe(false);
    // Kündigung zurücknehmen
    await a.bookAddon(tenant.id, "invoicing", {}, now);
    expect(await a.hasModule(tenant.id, "invoicing", new Date("2026-12-15T00:00:00Z"))).toBe(true);
  });

  it("Abrechnung: im Monat aktive Option einmal voll, kostenlose und im Paket enthaltene nicht", async () => {
    const { effectivePlan, withTopUps, invoiceFor, currentMonth } = await import("@/lib/billing");
    const { year, month } = currentMonth("Europe/Berlin");
    const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const a = await import("@/lib/addons");
    await prisma.addonPrice.create({ data: { key: "field_app", monthlyPriceCents: 3500 } });
    await a.bookAddon(tenant.id, "field_app", {}, new Date(Date.now() - 60_000));
    await a.bookAddon(tenant.id, "customer_contact", { priceCents: 0 }, new Date(Date.now() - 60_000));
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    const plan = await withTopUps(tenant.id, effectivePlan(t, null), year, month);
    expect(plan.addons.map((x) => `${x.key}:${x.priceCents}`).sort()).toEqual(["field_app:3500", "invoicing:1900"]);
    const inv = invoiceFor(plan, { calls: 0, seconds: 0, minutes: 0, sms: 0, emails: 0, tickets: 0, emergencies: 0 }, { includeSetupFee: false });
    expect(inv.lines.map((l) => l.label)).toContain("Zusatzoption Techniker-App");
    expect((await withTopUps(tenant.id, effectivePlan(t, null), prev.y, prev.m)).addons.map((x) => x.key)).not.toContain("field_app");
    // Im Paket enthalten → kein Aufpreis, trotzdem aktiv
    const p = await prisma.plan.create({ data: { key: `p-${uid}`, name: "Komplett", monthlyPriceCents: 9900, includedMinutes: 300, overageCentsPerMinute: 39, features: ["invoicing", "field_app"] } });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { planId: p.id } });
    const t2 = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id }, include: { planRef: true } });
    expect((await withTopUps(tenant.id, effectivePlan(t2, t2.planRef), year, month)).addons).toEqual([]);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { planId: null } });
    await prisma.plan.delete({ where: { id: p.id } });
  });

  it("Techniker-App-Link funktioniert nur mit gebuchter Option", async () => {
    const j = await import("@/lib/services/jobs");
    const e = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Test Tech", role: "FIELD_TECH" } });
    const token = await j.issueAppToken(tenant.id, e.id);
    expect((await j.employeeForToken(token)).id).toBe(e.id);
    await prisma.tenantAddon.updateMany({ where: { tenantId: tenant.id, key: "field_app" }, data: { endsAt: new Date(Date.now() - 1000) } });
    await expect(j.employeeForToken(token)).rejects.toMatchObject({ status: 404 });
  });
});

describe.skipIf(!enabled)("Zahlungsabgleich per Kontoauszug", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  beforeAll(async () => {
    tenant = await prisma.tenant.create({ data: { name: `Bank ${uid}`, slug: `p1bank-${uid}`, industry: "trades", status: "ACTIVE", settings: { invoicing: { address: "Gartenstraße 8, 55116 Mainz", taxNumber: "26/123/45678", iban: "DE89370400440532013000" } }, addons: { create: [{ key: "invoicing", priceCents: 1900 }] } } });
  });
  afterAll(async () => {
    await prisma.bill.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("markiert eindeutige Zahlungen als bezahlt, legt Vorschläge ab, verarbeitet nichts doppelt", async () => {
    const { createDraft, issueBill } = await import("@/lib/services/bills");
    const { importStatement, resolveSuggestion } = await import("@/lib/services/bank-import");
    const c1 = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "+4915112345401", name: "Jonas Weber", address: "Am Rhein 3, 55116 Mainz" } });
    const c2 = await prisma.customer.create({ data: { tenantId: tenant.id, phone: "+4915112345402", companyName: "Hausverwaltung Kurz", address: "Bahnhofstr. 12, Mainz" } });
    const line = { description: "Rohrbruch", quantity: 1, unit: "pauschal", unitCents: 8900, taxRate: 19 };
    const a = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "INVOICE", customerId: c1.id, lines: [line] })).id);
    const b = await issueBill(tenant.id, (await createDraft(tenant.id, { kind: "INVOICE", customerId: c2.id, lines: [{ ...line, unitCents: 50000 }] })).id);
    const camt = `<Document><BkToCstmrStmt><Stmt>
      <Ntry><Amt Ccy="EUR">${(a.grossCents / 100).toFixed(2)}</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-24</Dt></BookgDt><NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Jonas Weber</Nm></Dbtr></RltdPties><RmtInf><Ustrd>${a.number}</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
      <Ntry><Amt Ccy="EUR">200.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-25</Dt></BookgDt><NtryDtls><TxDtls><RltdPties><Dbtr><Nm>HV Kurz</Nm></Dbtr></RltdPties><RmtInf><Ustrd>Abschlag ${b.number}</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
      <Ntry><Amt Ccy="EUR">12.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-25</Dt></BookgDt><NtryDtls><TxDtls><RmtInf><Ustrd>Erstattung</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
    </Stmt></BkToCstmrStmt></Document>`;
    const r = await importStatement(tenant.id, camt);
    expect(r).toMatchObject({ credits: 3, suggested: 1, unmatched: 1, duplicates: 0 });
    expect(r.matched.map((m) => m.number)).toEqual([a.number]);
    const pa = await prisma.bill.findUniqueOrThrow({ where: { id: a.id } });
    expect(pa.status).toBe("PAID");
    expect(pa.paidAt?.toISOString().slice(0, 10)).toBe("2026-10-24");
    // unzugeordnete Zahlungen werden nicht gespeichert
    expect(await prisma.bankTransaction.count({ where: { tenantId: tenant.id } })).toBe(2);
    const again = await importStatement(tenant.id, camt);
    expect(again).toMatchObject({ duplicates: 2, suggested: 0, matched: [] });

    const s = await prisma.bankTransaction.findFirstOrThrow({ where: { tenantId: tenant.id, status: "SUGGESTED" } });
    expect(s.billId).toBe(b.id);
    await resolveSuggestion(tenant.id, s.id, "accept");
    expect((await prisma.bill.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PAID");
    await expect(resolveSuggestion(tenant.id, s.id, "accept")).rejects.toMatchObject({ status: 404 });
  });
});

describe.skipIf(!enabled)("Phase 2 – Fahrzeiten & Gebiete", () => {
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  const key = (a: string) => crypto.createHash("sha256").update(a.toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim()).digest("hex");
  const places: Record<string, [number, number]> = {
    "Gartenstraße 8, 55116 Mainz": [50.0, 8.27],
    "Zeil 1, 60313 Frankfurt": [50.11, 8.68],
    "Am Rhein 3, 55116, Deutschland": [50.0, 8.28],
  };
  beforeAll(async () => {
    for (const [a, [lat, lon]] of Object.entries(places)) await prisma.geoCache.upsert({ where: { key: key(a) }, create: { key: key(a), lat, lon, provider: "ors" }, update: { lat, lon } });
    tenant = await prisma.tenant.create({ data: { name: `Planung ${uid}`, slug: `p2-${uid}`, industry: "trades", status: "ACTIVE", settings: { appointments: { leadMin: 0, bufferMin: 0 }, planning: { depotAddress: "Gartenstraße 8, 55116 Mainz", travelFeeFromMin: 30, travelFeeCents: 2500 } }, addons: { create: [{ key: "planning", priceCents: 1900 }] } } });
  });
  afterAll(async () => {
    await settleDeferred();
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("wählt nach Fahrzeit, nennt die Anfahrt und berechnet den Zuschlag", async () => {
    const ffm = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Frank Fern", role: "FIELD_TECH", baseAddress: "Zeil 1, 60313 Frankfurt", maxTravelMin: 30 } });
    const mz = await prisma.employee.create({ data: { tenantId: tenant.id, name: "Mia Nah", role: "FIELD_TECH", maxTravelMin: 30 } });
    const r = await processServiceRequest(tenant, resolveConfig(tenant), { customer: { phone: "+4915112345501", name: "Jonas Weber", address: "Am Rhein 3", postalCode: "55116" }, category: "Rohrbruch", description: "Leck" });
    expect(r.ticket.assignedEmployeeId).toBe(mz.id);
    expect(r.routing.reason).toMatch(/Anfahrt ca\. \d+ Min\./);
    expect(r.routing.areaMatch).toBe(true);
    const { travelFeeFor, locate } = await import("@/lib/services/travel");
    const target = await locate({ address: "Am Rhein 3", postalCode: "55116" });
    expect(await travelFeeFor(tenant.id, resolveConfig(tenant), mz, target)).toBeNull();
    expect(await travelFeeFor(tenant.id, resolveConfig(tenant), ffm, target)).toMatchObject({ cents: 2500 });
  });

  it("ohne gebuchte Einsatzplanung bleibt es bei PLZ-Gebieten", async () => {
    await prisma.tenantAddon.updateMany({ where: { tenantId: tenant.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const r = await processServiceRequest(tenant, resolveConfig(tenant), { customer: { phone: "+4915112345502", address: "Am Rhein 3", postalCode: "55116" }, category: "Rohrbruch", description: "Leck" });
    expect(r.routing.reason).not.toContain("Anfahrt");
  });
});
