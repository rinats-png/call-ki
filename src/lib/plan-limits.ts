import { prisma } from "./db";
import { HttpError } from "./http";
import { effectivePlan, hasFeature, planForTenant, type EffectivePlan } from "./billing";
import { PLAN_FEATURES } from "./platform/registry";

/**
 * Paketgrenzen serverseitig durchsetzen (Zugänge, Rufnummern, Funktionen).
 * Ohne Paket gibt es keine Einschränkung (Altbestand, siehe effectivePlan).
 */
const featureLabel = (f: string) => PLAN_FEATURES.find((x) => x.key === f)?.label ?? f;

export async function assertUserSlot(tenantId: string) {
  const { plan } = await planForTenant(tenantId);
  if (plan.maxUsers == null) return;
  const used = await prisma.user.count({ where: { tenantId, disabled: false } });
  if (used >= plan.maxUsers) throw new HttpError(409, `Das Paket „${plan.name}“ umfasst ${plan.maxUsers} Zugänge – alle sind vergeben. Bitte einen Zugang deaktivieren oder das Paket wechseln.`);
}

export async function assertNumberSlot(tenantId: string, e164: string) {
  const { plan } = await planForTenant(tenantId);
  if (plan.maxNumbers == null) return;
  if (await prisma.phoneNumber.findFirst({ where: { tenantId, e164 } })) return; // bestehende Nummer bearbeiten
  const used = await prisma.phoneNumber.count({ where: { tenantId } });
  if (used >= plan.maxNumbers) throw new HttpError(409, `Das Paket „${plan.name}“ umfasst ${plan.maxNumbers} Rufnummer(n). Bitte das Paket wechseln.`);
}

export function assertPlanFeature(plan: EffectivePlan, feature: string) {
  if (!hasFeature(plan, feature)) throw new HttpError(409, `„${featureLabel(feature)}“ ist im Paket „${plan.name}“ nicht enthalten.`);
}

/** Paket eines Kunden nach einer (geplanten) Paketänderung – für Prüfungen im selben Request. */
export async function planAfterChange(tenantId: string, planId: string | null | undefined): Promise<EffectivePlan> {
  if (planId === undefined) return (await planForTenant(tenantId)).plan;
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  return effectivePlan(t, planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null);
}
