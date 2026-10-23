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
};

function cleanType(t?: string | null): CustomerType | undefined {
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
      tickets: { select: { id: true, category: true, urgency: true, summary: true, transcript: true, appointmentStart: true, status: true, createdAt: true } },
      calls: { select: { id: true, startedAt: true, durationSec: true, transcript: true, summary: true } },
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
  for (const call of calls) {
    const r = await purgeCallAtProviders(call);
    if (!r.ok) {
      providerComplete = false;
      logger.warn("erase.provider_incomplete", { tenantId, callId: call.id, details: r.details });
    }
  }
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { tenantId, OR: [{ ticket: { customerId: c.id } }, { recipient: c.phone }, ...(c.email ? [{ recipient: c.email }] : [])] } }),
    prisma.call.deleteMany({ where: { tenantId, OR: [{ customerId: c.id }, { fromNumber: c.phone }] } }),
    prisma.customer.delete({ where: { id: c.id } }), // Tickets per Cascade
  ]);
  return { providerComplete };
}
