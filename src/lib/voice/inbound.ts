import { prisma } from "../db";
import { normalizePhone } from "../phone";

/** Mandant + Nummer zur angerufenen Twilio-Nummer. */
export async function tenantForCalledNumber(to: string | undefined) {
  const e164 = normalizePhone(to);
  if (!e164) return null;
  return prisma.phoneNumber.findUnique({ where: { e164 }, include: { tenant: { include: { planRef: true } } } });
}

export async function twilioParams(req: Request): Promise<Record<string, string>> {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  return params;
}
