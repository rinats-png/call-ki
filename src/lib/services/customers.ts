import { prisma } from "../db";
import { normalizePhone } from "../phone";
import { normalizePostalCode } from "../postal";
import { CUSTOMER_TYPES, type CustomerType } from "../constants";

export async function findCustomerByPhone(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  return prisma.customer.findUnique({
    where: { phone },
    include: {
      tickets: { orderBy: { createdAt: "desc" }, take: 3, include: { assignedEmployee: { select: { name: true } } } },
    },
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
};

function cleanType(t?: string | null): CustomerType | undefined {
  return t && (CUSTOMER_TYPES as readonly string[]).includes(t) ? (t as CustomerType) : undefined;
}

function cleanEmail(e?: string | null): string | undefined {
  if (!e) return undefined;
  const v = e.trim().toLowerCase().replace(/\s+at\s+/g, "@").replace(/\s+punkt\s+/g, ".").replace(/\s/g, "");
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? v : undefined;
}

/**
 * Legt Neukunden an bzw. ergänzt Bestandskunden. Leere Werte überschreiben
 * niemals vorhandene Daten. Ein Kunde mit mindestens einem Ticket gilt als EXISTING.
 */
export async function upsertCustomer(input: CustomerInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Ungültige Telefonnummer");
  const data = {
    name: input.name?.trim() || undefined,
    companyName: input.companyName?.trim() || undefined,
    email: cleanEmail(input.email),
    address: input.address?.trim() || undefined,
    postalCode: normalizePostalCode(input.postalCode) ?? undefined,
    customerType: cleanType(input.customerType),
  };
  return prisma.customer.upsert({
    where: { phone },
    create: { phone, ...data },
    update: data,
  });
}

export async function markCustomerExisting(customerId: string) {
  await prisma.customer.updateMany({ where: { id: customerId, status: "NEW" }, data: { status: "EXISTING" } });
}
