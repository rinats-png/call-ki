import { PrismaClient } from "@prisma/client";

/**
 * Beispieldaten. WICHTIG: PLZ-Gebiete, Namen und UPNs vor dem Livebetrieb
 * durch die echten Daten der Storm GmbH ersetzen (Dashboard → Team oder Prisma Studio).
 */
const prisma = new PrismaClient();

async function main() {
  const employees = [
    { name: "Notdienst Team", role: "EMERGENCY_TECH", microsoftUpn: "notdienst@storm.gmbh", servicePostalCodes: "*", directPhone: "+4915100000001" },
    { name: "Techniker Nord", role: "PEST_EXPERT", microsoftUpn: "techniker.nord@storm.gmbh", servicePostalCodes: "20000-25999", directPhone: "+4915100000002" },
    { name: "Techniker Süd", role: "PEST_EXPERT", microsoftUpn: "techniker.sued@storm.gmbh", servicePostalCodes: "80000-87999", directPhone: "+4915100000003" },
    { name: "Techniker West", role: "PEST_EXPERT", microsoftUpn: "techniker.west@storm.gmbh", servicePostalCodes: "40000-47999,50000-53999", directPhone: "+4915100000004" },
    { name: "HACCP Spezialist", role: "B2B_SPECIALIST", microsoftUpn: "b2b@storm.gmbh", servicePostalCodes: "20,22,40,50,80", directPhone: "+4915100000005" },
    { name: "Backoffice", role: "BACKOFFICE", microsoftUpn: "info@storm.gmbh", servicePostalCodes: "*", directPhone: null },
  ];

  if ((await prisma.employee.count()) === 0) {
    await prisma.employee.createMany({ data: employees });
    console.log(`✔ ${employees.length} Mitarbeiter angelegt`);
  } else {
    console.log("• Mitarbeiter bereits vorhanden – übersprungen");
  }

  if (process.env.SEED_DEMO_DATA === "true" && (await prisma.callTicket.count()) === 0) {
    const all = await prisma.employee.findMany();
    const by = (n: string) => all.find((e) => e.name === n)?.id;
    const demo = [
      { phone: "+4940123456", name: "Anna Becker", address: "Mönckebergstraße 7, Hamburg", postalCode: "20095", customerType: "PRIVATE", pest: "Wespen", urgency: "HIGH", emp: "Techniker Nord", summary: "Wespennest am Balkon, Kinder im Haushalt.", status: "PROCESSED" },
      { phone: "+4922198765", name: "Thomas Wolf", companyName: "Restaurant Domblick", address: "Domkloster 2, Köln", postalCode: "50667", customerType: "B2B_HACCP", pest: "Schaben", urgency: "HIGH", emp: "HACCP Spezialist", summary: "Schaben in der Großküche, HACCP-Audit nächste Woche.", status: "PENDING" },
      { phone: "+4989555123", name: "Hausverwaltung Isar", companyName: "Isar Immobilien GmbH", address: "Leopoldstraße 40, München", postalCode: "80802", customerType: "PROPERTY_MANAGEMENT", pest: "Ratten", urgency: "MEDIUM", emp: "HACCP Spezialist", summary: "Rattenbefall im Müllraum einer Wohnanlage.", status: "PROCESSED" },
      { phone: "+4915112345678", name: "Lena Koch", address: "Kirchweg 3", postalCode: "30159", customerType: "PRIVATE", pest: "Wespen", urgency: "CRITICAL", emp: "Notdienst Team", summary: "Allergikerin gestochen, Nest im Kinderzimmer-Rollladen.", status: "ESCALATED" },
    ];
    for (const d of demo) {
      const c = await prisma.customer.create({
        data: { phone: d.phone, name: d.name, companyName: d.companyName, address: d.address, postalCode: d.postalCode, customerType: d.customerType, status: "EXISTING" },
      });
      await prisma.callTicket.create({
        data: { customerId: c.id, assignedEmployeeId: by(d.emp), pestType: d.pest, urgency: d.urgency, summary: d.summary, status: d.status,
          transcript: `KI: Storm GmbH, guten Tag! Wie kann ich helfen?\nKunde: ${d.summary}` },
      });
    }
    console.log(`✔ ${demo.length} Demo-Tickets angelegt`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
