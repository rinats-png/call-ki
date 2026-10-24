import { prisma } from "../db";
import { HttpError } from "../http";
import { setting } from "../platform/config";
import { audit } from "../audit";
import { emailLayout, sendEmail } from "../notify";
import { xmlEscape as h } from "../twiml";
import { currentMonth, effectivePlan, MINUTE_PACKS, minutePackPrice } from "../billing";

/** Höchstens so viele Minutenpakete je Kunde und Monat (Schutz vor Fehlklicks) */
export const MAX_TOPUPS_PER_MONTH = 5;

/** Hinweis an den Betreiber (ALERT_EMAIL, sonst alle Plattform-Admins) */
export async function notifyOperator(subject: string, text: string) {
  const emails = (setting("ALERT_EMAIL") ?? "").split(/[,;\s]+/).filter(Boolean);
  const to = emails.length ? emails : (await prisma.user.findMany({ where: { role: "PLATFORM_ADMIN", disabled: false }, select: { email: true } })).map((u) => u.email);
  for (const addr of to) await sendEmail({ to: addr, subject, html: emailLayout(`<p>${h(text)}</p>`, "KI-Telefonzentrale · Abrechnung"), purpose: "BILLING_NOTICE" });
}

/** Kunde bucht ein Minutenpaket für den laufenden Monat – wirkt sofort. */
export async function bookMinutePack(tenantId: string, userId: string, minutes: number) {
  if (!(MINUTE_PACKS as readonly number[]).includes(minutes)) throw new HttpError(400, "Unbekanntes Minutenpaket.");
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { planRef: true } });
  const plan = effectivePlan(t, t.planRef);
  if (!plan.planId || plan.overageCentsPerMinute <= 0) throw new HttpError(400, "Für Ihr Paket sind keine Minutenpakete hinterlegt. Bitte wenden Sie sich an uns.");
  const { year, month } = currentMonth(t.timezone);
  if ((await prisma.minuteTopUp.count({ where: { tenantId, year, month } })) >= MAX_TOPUPS_PER_MONTH) throw new HttpError(429, "In diesem Monat wurden bereits mehrere Minutenpakete gebucht. Bitte wenden Sie sich an uns.");
  const top = await prisma.minuteTopUp.create({ data: { tenantId, year, month, minutes, priceCents: minutePackPrice(plan, minutes), createdById: userId } });
  await audit({ tenantId, userId, action: "billing.minutes_booked", target: top.id, meta: { minutes, priceCents: top.priceCents, period: `${year}-${month}` } });
  await notifyOperator(`Minutenpaket gebucht: ${t.name}`, `${t.name} hat ${minutes} zusätzliche Minuten für ${String(month).padStart(2, "0")}/${year} gebucht (${(top.priceCents / 100).toFixed(2).replace(".", ",")} € netto). Erscheint in der Abrechnung dieses Monats.`);
  return top;
}

/** Kunde wünscht ein anderes Paket – der Betreiber entscheidet in der Verwaltung. */
export async function requestPlanChange(tenantId: string, userId: string, planId: string, note: string) {
  const [t, plan] = await Promise.all([prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }), prisma.plan.findFirst({ where: { id: planId, active: true } })]);
  if (!plan) throw new HttpError(400, "Dieses Paket gibt es nicht (mehr).");
  if (t.planId === plan.id) throw new HttpError(400, "Das ist bereits Ihr Paket.");
  if (await prisma.planChangeRequest.findFirst({ where: { tenantId, status: "OPEN" } })) throw new HttpError(409, "Es gibt bereits eine offene Anfrage. Wir melden uns.");
  const req = await prisma.planChangeRequest.create({ data: { tenantId, planId: plan.id, planName: plan.name, note: note.slice(0, 500), createdById: userId } });
  await audit({ tenantId, userId, action: "billing.plan_change_requested", target: req.id, meta: { planId: plan.id } });
  await notifyOperator(`Paketwechsel angefragt: ${t.name}`, `${t.name} möchte zum Paket „${plan.name}“ wechseln.${note ? ` Nachricht: ${note.slice(0, 500)}` : ""} Annehmen oder ablehnen unter Verwaltung → Abrechnung.`);
  return req;
}

/** Betreiber nimmt an (Paket wird sofort umgestellt) oder lehnt ab. */
export async function decidePlanChange(id: string, adminId: string, approve: boolean) {
  const req = await prisma.planChangeRequest.findUnique({ where: { id } });
  if (!req || req.status !== "OPEN") throw new HttpError(404, "Anfrage nicht gefunden oder bereits erledigt.");
  if (approve && !(await prisma.plan.findUnique({ where: { id: req.planId } }))) throw new HttpError(400, "Das gewünschte Paket gibt es nicht mehr.");
  await prisma.$transaction([
    prisma.planChangeRequest.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", handledAt: new Date(), handledById: adminId } }),
    ...(approve ? [prisma.tenant.update({ where: { id: req.tenantId }, data: { planId: req.planId } })] : []),
  ]);
  await audit({ tenantId: req.tenantId, userId: adminId, action: approve ? "billing.plan_change_approved" : "billing.plan_change_rejected", target: id, meta: { planId: req.planId } });
  const admins = await prisma.user.findMany({ where: { tenantId: req.tenantId, role: "TENANT_ADMIN", disabled: false }, select: { email: true } });
  for (const a of admins) {
    await sendEmail({
      tenantId: req.tenantId, to: a.email, purpose: "BILLING_NOTICE",
      subject: approve ? `Ihr Paket ist jetzt „${req.planName}“` : "Ihre Anfrage zum Paketwechsel",
      html: emailLayout(`<p>${approve ? `Ihr Paket wurde auf <b>${h(req.planName)}</b> umgestellt. Es gilt ab sofort.` : `Ihre Anfrage zum Paket „${h(req.planName)}“ konnten wir so nicht umsetzen. Wir melden uns bei Ihnen.`}</p>`, "KI-Telefonzentrale"),
    });
  }
}
