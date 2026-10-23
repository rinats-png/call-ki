import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

/**
 * Entwicklungs-/Demo-Daten (NICHT in Produktion ausführen):
 *   - Plattform-Admin admin@example.com / demo-passwort-123
 *   - Demo-Mandant "Storm GmbH" (Schädlingsbekämpfung) mit Admin storm@example.com / demo-passwort-123
 *   - Demo-Nummer +4930123456789, Team, Kunden, Vorgänge
 * In Produktion legt man den ersten Admin über /setup an.
 */
const prisma = new PrismaClient();

function hash(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return `scrypt$131072$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.log("Produktion erkannt – Seed übersprungen (ALLOW_DEMO_SEED=true erzwingt).");
    return;
  }
  if (await prisma.user.count()) {
    console.log("• Daten vorhanden – Seed übersprungen");
    return;
  }
  const pw = hash("demo-passwort-123");
  await prisma.user.create({ data: { email: "admin@example.com", name: "Plattform Admin", role: "PLATFORM_ADMIN", passwordHash: pw } });

  const t = await prisma.tenant.create({
    data: {
      name: "Storm GmbH", slug: "storm-gmbh", industry: "pest_control", status: "ACTIVE", plan: "PRO", monthlyMinuteLimit: 2000,
      settings: { assistantName: "Lena", serviceArea: "Hamburg, Köln, München und Umgebung", backofficeEmail: "" },
    },
  });
  await prisma.user.create({ data: { email: "storm@example.com", name: "Storm Büro", role: "TENANT_ADMIN", tenantId: t.id, passwordHash: pw } });
  await prisma.phoneNumber.create({ data: { tenantId: t.id, e164: "+4930123456789", label: "Hauptnummer" } });

  const emp = async (name: string, role: string, codes: string, phone?: string) =>
    prisma.employee.create({ data: { tenantId: t.id, name, role, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, servicePostalCodes: codes, directPhone: phone } });
  const notdienst = await emp("Notdienst Team", "EMERGENCY_TECH", "*", "+4915100000001");
  const nord = await emp("Techniker Nord", "FIELD_TECH", "20000-25999", "+4915100000002");
  await emp("Techniker Süd", "FIELD_TECH", "80000-87999", "+4915100000003");
  await emp("Techniker West", "FIELD_TECH", "40000-47999,50000-53999", "+4915100000004");
  const b2b = await emp("HACCP Spezialist", "SPECIALIST", "20,22,40,50,80", "+4915100000005");
  await emp("Büro", "BACKOFFICE", "*");

  const demo = [
    { phone: "+4940123456", name: "Anna Becker", address: "Mönckebergstraße 7, Hamburg", postalCode: "20095", type: "PRIVATE", cat: "Wespen", urg: "HIGH", emp: nord.id, sum: "Wespennest am Balkon, Kinder im Haushalt.", status: "PROCESSED", inDays: 1 },
    { phone: "+4922198765", name: "Thomas Wolf", company: "Restaurant Domblick", address: "Domkloster 2, Köln", postalCode: "50667", type: "BUSINESS", cat: "Schaben", urg: "HIGH", emp: b2b.id, sum: "Schaben in der Großküche, HACCP-Audit nächste Woche.", status: "PENDING" },
    { phone: "+4915112345678", name: "Lena Koch", address: "Kirchweg 3", postalCode: "30159", type: "PRIVATE", cat: "Wespen", urg: "CRITICAL", emp: notdienst.id, sum: "Allergikerin gestochen, Nest im Rollladenkasten.", status: "ESCALATED" },
  ];
  for (const d of demo) {
    const c = await prisma.customer.create({ data: { tenantId: t.id, phone: d.phone, name: d.name, companyName: d.company, address: d.address, postalCode: d.postalCode, customerType: d.type, status: "EXISTING" } });
    const call = await prisma.call.create({
      data: { tenantId: t.id, fromNumber: d.phone, toNumber: "+4930123456789", customerId: c.id, status: "ENDED", durationSec: 95 + Math.floor(Math.random() * 120), endedAt: new Date(), summary: d.sum,
        transcript: `Agent: Storm GmbH, guten Tag! Hier spricht Lena, die digitale Assistentin. Wie kann ich helfen?\nUser: ${d.sum}\nAgent: Ich kümmere mich darum.` },
    });
    const start = d.inDays ? new Date(Date.now() + d.inDays * 86400000) : null;
    await prisma.callTicket.create({
      data: { tenantId: t.id, customerId: c.id, callId: call.id, assignedEmployeeId: d.emp, category: d.cat, urgency: d.urg, summary: d.sum, status: d.status, transcript: call.transcript,
        ...(start ? { appointmentStart: start, appointmentEnd: new Date(start.getTime() + 3600000) } : {}) },
    });
  }
  console.log("✔ Demo-Daten angelegt: admin@example.com / storm@example.com (Passwort: demo-passwort-123)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
