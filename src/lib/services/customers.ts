import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { normalizePhone } from "../phone";
import { normalizePostalCode } from "../postal";
import { CUSTOMER_TYPES, type CustomerType } from "../constants";
import { logger } from "../logger";
import { purgeCallAtProviders } from "../voice/providers";

/** Alle Funktionen sind an einen Mandanten gebunden – es gibt keinen Zugriff ohne tenantId. */
export async function findCustomerByPhone(tenantId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  return prisma.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
    include: { tickets: { orderBy: { createdAt: "desc" }, take: 3, include: { assignedEmployee: { select: { name: true } } } } },
  });
}

export type CustomerInput = {
  phone: string;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  customerType?: string | null;
  notes?: string | null;
  /** Rufnummer ist nicht die verifizierte Anrufernummer: bestehende Angaben nicht überschreiben, nur Lücken füllen */
  onlyFillMissing?: boolean;
};

function cleanType(t?: string | null): CustomerType | undefined {
  if (t === "B2B_HACCP") return "BUSINESS"; // frühere Agenten-Konfiguration
  return t && (CUSTOMER_TYPES as readonly string[]).includes(t) ? (t as CustomerType) : undefined;
}

/** Wandelt gesprochene E-Mails um ("max punkt muster at web punkt de") und validiert. */
export function cleanEmail(e?: string | null): string | undefined {
  if (!e) return undefined;
  const v = e.trim().toLowerCase().replace(/\s+(at|ät)\s+/g, "@").replace(/\s+punkt\s+/g, ".").replace(/\s+(minus|bindestrich)\s+/g, "-").replace(/\s+unterstrich\s+/g, "_").replace(/\s/g, "");
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? v : undefined;
}

/** Legt an oder ergänzt. Leere Werte überschreiben nie vorhandene Daten. */
export async function upsertCustomer(tenantId: string, input: CustomerInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Ungültige Telefonnummer");
  const data = {
    name: input.name?.trim() || undefined,
    companyName: input.companyName?.trim() || undefined,
    email: cleanEmail(input.email),
    address: input.address?.trim() || undefined,
    postalCode: normalizePostalCode(input.postalCode) ?? undefined,
    customerType: cleanType(input.customerType),
    notes: input.notes?.trim() || undefined,
  };
  if (input.onlyFillMissing) {
    const existing = await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId, phone } } });
    if (existing) {
      const gaps = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => v !== undefined && k !== "customerType" && !existing[k as keyof typeof existing]),
      );
      return Object.keys(gaps).length ? prisma.customer.update({ where: { id: existing.id }, data: gaps }) : existing;
    }
  }
  return prisma.customer.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone, ...data },
    update: data,
  });
}

export async function markCustomerExisting(tenantId: string, customerId: string) {
  await prisma.customer.updateMany({ where: { id: customerId, tenantId, status: "NEW" }, data: { status: "EXISTING" } });
}

/** DSGVO Art. 15: Datenauskunft */
export async function exportCustomerData(tenantId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      tickets: {
        select: {
          id: true, category: true, urgency: true, summary: true, transcript: true, appointmentStart: true, status: true, confirmation: true, createdAt: true,
          // Einsatzbericht ohne Bilddaten (Fotos/Unterschrift nur als Anzahl bzw. Zeitpunkt)
          jobReport: { select: { status: true, arrivedAt: true, finishedAt: true, findings: true, workDone: true, materials: true, hoursWorked: true, signatureName: true, signedAt: true, _count: { select: { photos: true } } } },
        },
      },
      calls: { select: { id: true, startedAt: true, durationSec: true, transcript: true, summary: true } },
      bills: { where: { status: { not: "DRAFT" } }, select: { kind: true, number: true, status: true, issueDate: true, recipient: true, lines: true, grossCents: true, paidAt: true } },
    },
  });
}

/**
 * DSGVO Art. 17: Löschung des Anrufers samt Vorgängen, Anrufen und Nachrichten –
 * auch bei den Anbietern (Retell/Twilio). Rückgabe: ob dort alles gelöscht werden konnte.
 */
export async function eraseCustomer(tenantId: string, customerId: string): Promise<false | { providerComplete: boolean }> {
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, phone: true, email: true } });
  if (!c) return false;
  const calls = await prisma.call.findMany({ where: { tenantId, OR: [{ customerId: c.id }, { fromNumber: c.phone }], providerPurgedAt: null } });
  let providerComplete = true;
  const purged: string[] = [];
  for (const call of calls) {
    const r = await purgeCallAtProviders(call);
    if (r.ok) purged.push(call.id);
    else {
      providerComplete = false;
      logger.warn("erase.provider_incomplete", { tenantId, callId: call.id, details: r.details });
    }
  }
  // Anrufe und Nachrichten werden anonymisiert statt gelöscht: Dauer, Status und Kanal bleiben für die
  // Abrechnung des laufenden Monats erhalten (loeschkonzept.md §5 R5); der Löschfristen-Job entfernt
  // die anonymen Anrufe nach dem Monatsabschluss.
  await prisma.$transaction([
    prisma.message.updateMany({ where: { tenantId, OR: [{ ticket: { customerId: c.id } }, { recipient: c.phone }, ...(c.email ? [{ recipient: c.email }] : [])] }, data: { recipient: "gelöscht", subject: null, body: "", ticketId: null, meta: Prisma.DbNull } }),
    prisma.call.updateMany({ where: { tenantId, OR: [{ customerId: c.id }, { fromNumber: c.phone }] }, data: { fromNumber: "gelöscht", customerId: null, transcript: null, summary: null, endReason: null } }),
    // Aufnahme-Link nur dort entfernen, wo die Löschung beim Anbieter geklappt hat – sonst versucht es der Löschfristen-Job erneut
    prisma.call.updateMany({ where: { id: { in: purged } }, data: { recordingUrl: null, providerPurgedAt: new Date() } }),
    prisma.callTicket.updateMany({ where: { tenantId, customerId: c.id }, data: { callId: null } }),
    prisma.bill.deleteMany({ where: { tenantId, customerId: c.id, status: "DRAFT" } }),
  ]);
  // Ausgestellte Belege unterliegen der Aufbewahrungspflicht (§ 147 AO, Art. 17 Abs. 3 lit. b DSGVO):
  // dann bleibt ein anonymer Kundendatensatz als Anker, die Belege behalten ihre eingefrorene Anschrift.
  const keptBills = await prisma.bill.count({ where: { tenantId, customerId: c.id } });
  if (keptBills) {
    await prisma.$transaction([
      prisma.callTicket.deleteMany({ where: { tenantId, customerId: c.id } }),
      prisma.customer.update({ where: { id: c.id }, data: { phone: `geloescht:${c.id}`, name: "gelöscht", companyName: null, email: null, address: null, postalCode: null, notes: null, smsConsentAt: null, smsConsentSource: null } }),
    ]);
  } else {
    await prisma.customer.delete({ where: { id: c.id } }); // Tickets per Cascade
  }
  return { providerComplete };
}
