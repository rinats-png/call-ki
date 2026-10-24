import { prisma } from "../db";
import { logger } from "../logger";

export const DEMO_SLUG = "demo-schaedlingsbekaempfung";

/** Test-Kunden mit erfundenen Daten nur in Entwicklung und Testumgebung (DEMO_SEED=true), nie in Produktion. */
export function demoAllowed(): boolean {
  return process.env.DEMO_SEED === "true" || process.env.NODE_ENV !== "production";
}

/**
 * Legt einen Test-Kunden mit Beispieldaten an (Mitarbeiter, Anrufer, Vorgänge, Anrufe der letzten Wochen),
 * damit Portal, Grafiken und Abrechnung sofort etwas zeigen. Keine echte Rufnummer, keine Zugänge –
 * der Plattform-Admin öffnet ihn über „Portal öffnen“.
 */
export async function createDemoTenant(): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) return { id: existing.id, created: false };
  const plan = await prisma.plan.findUnique({ where: { key: "BUSINESS" } });
  const now = Date.now();
  const day = 86400_000;

  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        slug: DEMO_SLUG,
        name: "Demo Schädlingsbekämpfung GmbH",
        industry: "pest_control",
        status: "ACTIVE",
        avvVersion: "DEMO",
        avvSignedAt: new Date(),
        planId: plan?.id ?? null,
        settings: {
          assistantName: "Eira",
          companyDescription: "Schädlingsbekämpfung für Privat, Gewerbe und Hausverwaltungen in Berlin und Umland. Wespen, Ratten, Mäuse, Bettwanzen, Schaben.",
          serviceArea: "Berlin und 40 km Umkreis",
          faq: "F: Kommen Sie am Wochenende?\nA: Nur im Notdienst mit Zuschlag.\nF: Was kostet eine Wespenentfernung?\nA: Ab 129 € inkl. Anfahrt im Stadtgebiet.",
          privacyUrl: "https://example.com/datenschutz",
          retentionDays: 90,
        },
        billingNote: "Test-Kunde mit Beispieldaten – kann jederzeit gelöscht werden.",
      },
    });
    await tx.phoneNumber.create({ data: { tenantId: t.id, e164: "+493000000000", label: "Demo (keine echte Nummer)" } });
    const [anna, ben, buero] = await Promise.all([
      tx.employee.create({ data: { tenantId: t.id, name: "Anna Krüger", role: "FIELD_TECH", email: "anna@example.com", servicePostalCodes: "10000-12999" } }),
      tx.employee.create({ data: { tenantId: t.id, name: "Ben Schulz", role: "EMERGENCY_TECH", email: "ben@example.com", servicePostalCodes: "*", directPhone: "+4915100000001" } }),
      tx.employee.create({ data: { tenantId: t.id, name: "Büro", role: "BACKOFFICE", email: "buero@example.com", servicePostalCodes: "*" } }),
    ]);
    const people = [
      { name: "Maria Weber", phone: "+4915200000011", postalCode: "10115", address: "Invalidenstraße 12, Berlin", customerType: "PRIVATE", status: "EXISTING" },
      { name: "Hausverwaltung Lindner", companyName: "Lindner Immobilien GmbH", phone: "+493000000012", postalCode: "10969", address: "Oranienstraße 5, Berlin", customerType: "PROPERTY_MANAGEMENT", status: "EXISTING" },
      { name: "Tom Becker", phone: "+4917600000013", postalCode: "12043", address: "Sonnenallee 80, Berlin", customerType: "PRIVATE", status: "NEW" },
      { name: "Bäckerei Hoffmann", companyName: "Bäckerei Hoffmann", phone: "+493000000014", postalCode: "10245", address: "Warschauer Str. 30, Berlin", customerType: "BUSINESS", status: "EXISTING" },
      { name: "Lisa Meyer", phone: "+4916000000015", postalCode: "14467", address: "Brandenburger Str. 2, Potsdam", customerType: "PRIVATE", status: "NEW" },
    ];
    const customers = [];
    for (const p of people) customers.push(await tx.customer.create({ data: { tenantId: t.id, ...p } }));

    const cases = [
      { c: 0, cat: "Wespen", urg: "HIGH", emp: anna.id, d: 1, dur: 184, sum: "Wespennest am Rollladenkasten über dem Kinderzimmer.", appt: 2 },
      { c: 1, cat: "Ratten", urg: "MEDIUM", emp: anna.id, d: 3, dur: 241, sum: "Rattenbefall im Müllraum, Objekt Oranienstraße 5.", appt: 4 },
      { c: 2, cat: "Bettwanzen", urg: "MEDIUM", emp: anna.id, d: 6, dur: 302, sum: "Verdacht auf Bettwanzen nach Urlaub, Bisse an den Armen.", appt: 7 },
      { c: 3, cat: "Schaben", urg: "CRITICAL", emp: ben.id, d: 9, dur: 156, sum: "Schaben in der Backstube – Lebensmittelbetrieb, Kontrolle morgen früh.", appt: null },
      { c: 4, cat: "Mäuse", urg: "LOW", emp: buero.id, d: 12, dur: 98, sum: "Mäuse im Gartenhaus, kein Zeitdruck.", appt: 15 },
      { c: 0, cat: "Rückruf", urg: "MEDIUM", emp: buero.id, d: 0, dur: 47, sum: "Rückfrage zum Termin, bitte zurückrufen.", appt: null },
    ];
    for (const k of cases) {
      const startedAt = new Date(now - k.d * day - 3 * 3600_000);
      const call = await tx.call.create({
        data: {
          tenantId: t.id, provider: "demo", fromNumber: customers[k.c].phone, toNumber: "+493000000000", customerId: customers[k.c].id,
          status: "ENDED", startedAt, endedAt: new Date(startedAt.getTime() + k.dur * 1000), durationSec: k.dur,
          summary: k.sum, transcript: `Agent: Demo Schädlingsbekämpfung, guten Tag! Hier spricht Eira, die digitale Assistentin.\nAnrufer: ${k.sum}`,
        },
      });
      const start = k.appt != null ? new Date(Math.floor((now + (k.appt - k.d) * day) / 3600_000) * 3600_000) : null;
      await tx.callTicket.create({
        data: {
          tenantId: t.id, customerId: customers[k.c].id, callId: call.id, assignedEmployeeId: k.emp, category: k.cat, urgency: k.urg,
          summary: k.sum, status: k.d > 5 ? "CLOSED" : k.urg === "CRITICAL" ? "ESCALATED" : "PROCESSED",
          appointmentStart: start, appointmentEnd: start ? new Date(start.getTime() + 60 * 60_000) : null, createdAt: startedAt,
        },
      });
    }
    // Weitere kurze Anrufe über die letzten 25 Tage für Verbrauchsgrafiken
    for (let i = 0; i < 40; i++) {
      const startedAt = new Date(now - ((i * 0.62) % 25) * day - (i % 9) * 3600_000);
      const dur = 45 + ((i * 37) % 260);
      await tx.call.create({ data: { tenantId: t.id, provider: "demo", fromNumber: customers[i % 5].phone, toNumber: "+493000000000", customerId: customers[i % 5].id, status: "ENDED", startedAt, endedAt: new Date(startedAt.getTime() + dur * 1000), durationSec: dur } });
    }
    return { id: t.id, created: true };
  }, { timeout: 30_000 });
}

/**
 * Testumgebung (DEMO_SEED=true): Test-Kunden einmalig automatisch anlegen. Ein Merker verhindert,
 * dass ein gelöschter Test-Kunde wieder auftaucht.
 */
export async function autoSeedDemo(): Promise<void> {
  if (process.env.DEMO_SEED !== "true") return;
  if (await prisma.platformSetting.findUnique({ where: { key: "DEMO_SEEDED" } })) return;
  const marked = await prisma.platformSetting.create({ data: { key: "DEMO_SEEDED", value: new Date().toISOString() } }).catch(() => null);
  if (!marked) return; // paralleler Aufruf war schneller
  await createDemoTenant().catch((err) => logger.error("demo.seed_failed", { error: (err as Error).message }));
}
