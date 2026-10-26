import type { Plan, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { logger } from "./logger";
import { settingNumber } from "./platform/config";
import { emailLayout, sendEmail } from "./notify";
import { env } from "./env";
import { xmlEscape as h } from "./twiml";
import { invoiceFor, monthRange, usageForRange, type EffectivePlan, type Usage } from "./billing";
import { zonedParts } from "./time";

/**
 * Testphase: Standard 30 Tage und 100 Minuten (Verwaltung → Plattform: TRIAL_DAYS, TRIAL_MINUTES).
 * Während des Tests wird nichts berechnet; im Monat des Testendes nur anteilig. Am Ende geht es mit dem
 * gewählten Paket weiter, sonst wird der Kunde pausiert (Anrufe → Ersatznummer), bis er ein Paket wählt.
 */
export const trialDays = () => Math.max(1, settingNumber("TRIAL_DAYS", 30));
export const trialMinutesDefault = () => Math.max(0, settingNumber("TRIAL_MINUTES", 100));

type T = Pick<Tenant, "id" | "trialStartedAt" | "trialEndsAt" | "trialMinutes" | "trialNextPlanId" | "trialNotice" | "createdAt" | "status">;
export const trialActive = (t: Pick<Tenant, "trialEndsAt">, now = new Date()) => !!t.trialEndsAt && t.trialEndsAt > now;

export async function trialStatus(t: T, now = new Date()) {
  if (!t.trialEndsAt) return null;
  const used = await usageForRange(t.id, t.trialStartedAt ?? t.createdAt, t.trialEndsAt < now ? t.trialEndsAt : now, 60);
  const next = t.trialNextPlanId ? await prisma.plan.findUnique({ where: { id: t.trialNextPlanId }, select: { id: true, name: true, monthlyPriceCents: true } }) : null;
  return {
    active: trialActive(t, now), endsAt: t.trialEndsAt.toISOString(), startedAt: (t.trialStartedAt ?? t.createdAt).toISOString(),
    daysLeft: Math.max(0, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / 86400_000)),
    minutesUsed: Math.round(used.minutes), minutesIncluded: t.trialMinutes, nextPlan: next,
    /** Test vorbei und noch kein Paket: Kunde ist pausiert und soll eins wählen */
    ended: t.trialNotice >= 3 && !trialActive(t, now) && t.status === "PAUSED",
  };
}

export async function startTrial(tenantId: string, opts: { days?: number; minutes?: number } = {}, now = new Date()) {
  const days = opts.days ?? trialDays();
  return prisma.tenant.update({ where: { id: tenantId }, data: { trialStartedAt: now, trialEndsAt: new Date(now.getTime() + days * 86400_000), trialMinutes: opts.minutes ?? trialMinutesDefault(), trialNotice: 0 } });
}

export async function extendTrial(tenantId: string, days: number, now = new Date()) {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!t.trialEndsAt) throw new HttpError(409, "Keine Testphase.");
  const base = t.trialEndsAt > now ? t.trialEndsAt : now;
  const wasPausedByTrial = t.trialNotice >= 3 && t.status === "PAUSED";
  return prisma.tenant.update({ where: { id: tenantId }, data: { trialEndsAt: new Date(base.getTime() + days * 86400_000), trialNotice: 0, ...(wasPausedByTrial ? { status: "ACTIVE" } : {}) } });
}

/** Paket für die Zeit nach dem Test wählen. Ist der Test schon vorbei, wird sofort umgestellt und wieder aktiviert. */
export async function chooseTrialPlan(tenantId: string, planId: string, now = new Date()) {
  const [t, plan] = await Promise.all([prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }), prisma.plan.findFirst({ where: { id: planId, active: true } })]);
  if (!plan) throw new HttpError(404, "Paket nicht gefunden.");
  if (!t.trialEndsAt) throw new HttpError(409, "Keine Testphase – Paketwechsel bitte unter Tarif anfragen.");
  if (trialActive(t, now)) return prisma.tenant.update({ where: { id: tenantId }, data: { trialNextPlanId: plan.id } });
  return convertTrial(t, plan);
}

async function convertTrial(t: Tenant, plan: Pick<Plan, "id">) {
  // Nur eine wegen des Testendes pausierte Kündigung wird automatisch wieder aktiviert (nicht z. B. Vertragsende)
  const reactivate = t.status === "PAUSED" && t.trialNotice >= 3;
  return prisma.tenant.update({ where: { id: t.id }, data: { planId: plan.id, trialNextPlanId: null, ...(reactivate ? { status: "ACTIVE" } : {}) } });
}

/**
 * Abrechnung im Monat mit Testphase: Grundpreis, Freiminuten und Zusatzoptionen anteilig für die Tage nach dem Test,
 * Verbrauch nur ab Testende. Liegt der ganze Monat im Test, wird nichts berechnet.
 */
export async function applyTrialToMonth(t: Pick<Tenant, "id" | "trialStartedAt" | "trialEndsAt" | "createdAt">, plan: EffectivePlan, usage: Usage, start: Date, end: Date): Promise<{ plan: EffectivePlan; usage: Usage; note: string | null }> {
  if (!t.trialEndsAt) return { plan, usage, note: null };
  const tStart = t.trialStartedAt ?? t.createdAt;
  if (t.trialEndsAt <= start || tStart >= end) return { plan, usage, note: null };
  const paidFrom = t.trialEndsAt > start ? t.trialEndsAt : start;
  const factor = paidFrom >= end ? 0 : (end.getTime() - paidFrom.getTime()) / (end.getTime() - start.getTime());
  const until = t.trialEndsAt.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const p: EffectivePlan = {
    ...plan,
    monthlyPriceCents: Math.round(plan.monthlyPriceCents * factor),
    includedMinutes: Math.round(plan.includedMinutes * factor) + plan.topUps.reduce((n, x) => n + x.minutes, 0) - Math.round(plan.topUps.reduce((n, x) => n + x.minutes, 0) * factor),
    includedSms: Math.round(plan.includedSms * factor),
    addons: plan.addons.map((a) => ({ ...a, priceCents: Math.round(a.priceCents * factor) })).filter((a) => a.priceCents > 0),
  };
  const u = factor === 0 ? { ...usage, calls: 0, seconds: 0, minutes: 0, sms: 0 } : await usageForRange(t.id, paidFrom, end, plan.billingIncrementSec);
  return { plan: p, usage: { ...usage, calls: u.calls, seconds: u.seconds, minutes: u.minutes, sms: u.sms }, note: factor === 0 ? `Testphase bis ${until} – kostenlos` : `Testphase bis ${until} – anteilig ab Testende` };
}

async function mailAdmins(t: Pick<Tenant, "id" | "name">, subject: string, inner: string) {
  const admins = await prisma.user.findMany({ where: { tenantId: t.id, role: "TENANT_ADMIN", disabled: false }, select: { email: true } });
  for (const a of admins) await sendEmail({ tenantId: t.id, to: a.email, subject, html: emailLayout(inner, h(t.name)), purpose: "BILLING_NOTICE" });
}

/** Cron: Erinnerungen 7 Tage und 1 Tag vorher, am Ende Umstellung auf das gewählte Paket bzw. Pause. */
export async function runTrialLifecycle(now = new Date()) {
  const list = await prisma.tenant.findMany({ where: { trialEndsAt: { not: null }, trialNotice: { lt: 3 } }, take: 500 });
  const link = `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/settings/plan`;
  let reminded = 0, converted = 0, paused = 0;
  for (const t of list) {
    const left = (t.trialEndsAt!.getTime() - now.getTime()) / 86400_000;
    const until = t.trialEndsAt!.toLocaleDateString("de-DE", { timeZone: t.timezone });
    try {
      if (left <= 0) {
        if (t.trialNextPlanId && (await prisma.plan.findUnique({ where: { id: t.trialNextPlanId } }))) {
          await convertTrial(t, { id: t.trialNextPlanId });
          await prisma.tenant.update({ where: { id: t.id }, data: { trialNotice: 3 } });
          await mailAdmins(t, "Ihre Testphase ist zu Ende – Ihr Paket ist aktiv", `<p>Ihre Testphase ist beendet. Ihr gewähltes Paket ist jetzt aktiv, Ihre KI-Telefonzentrale läuft ohne Unterbrechung weiter.</p><p><a href="${h(link)}">Tarif & Verbrauch ansehen</a></p>`);
          converted++;
        } else {
          await prisma.tenant.update({ where: { id: t.id }, data: { trialNotice: 3, ...(t.status === "ACTIVE" ? { status: "PAUSED" } : {}) } });
          await mailAdmins(t, "Ihre Testphase ist beendet", `<p>Ihre Testphase ist am ${h(until)} zu Ende gegangen. Anrufe gehen jetzt wieder an Ihre Ersatznummer.</p><p>Wählen Sie ein Paket, dann nimmt Eira sofort wieder für Sie ab: <a href="${h(link)}">Paket wählen</a></p>`);
          paused++;
        }
      } else if (left <= 1 && t.trialNotice < 2) {
        await prisma.tenant.update({ where: { id: t.id }, data: { trialNotice: 2 } });
        await mailAdmins(t, "Morgen endet Ihre Testphase", `<p>Ihre Testphase endet am <b>${h(until)}</b>.${t.trialNextPlanId ? " Danach geht es nahtlos mit Ihrem gewählten Paket weiter." : " Wählen Sie jetzt ein Paket, damit Eira ohne Unterbrechung weiter für Sie abnimmt."}</p><p><a href="${h(link)}">${t.trialNextPlanId ? "Tarif ansehen" : "Paket wählen"}</a></p>`);
        reminded++;
      } else if (left <= 7 && t.trialNotice < 1) {
        await prisma.tenant.update({ where: { id: t.id }, data: { trialNotice: 1 } });
        await mailAdmins(t, "Noch 7 Tage Testphase", `<p>Ihre Testphase läuft noch bis <b>${h(until)}</b>.${t.trialNextPlanId ? " Ihr gewähltes Paket startet danach automatisch." : " Wählen Sie rechtzeitig ein Paket, dann geht es ohne Unterbrechung weiter."}</p><p><a href="${h(link)}">${t.trialNextPlanId ? "Tarif ansehen" : "Paket wählen"}</a></p>`);
        reminded++;
      }
    } catch (e) {
      logger.error("trial.lifecycle_failed", { tenantId: t.id, error: (e as Error).message });
    }
  }
  if (reminded || converted || paused) logger.info("trial.lifecycle", { reminded, converted, paused });
  return { checked: list.length, reminded, converted, paused };
}

/** Rechnung eines Monats inkl. Testphase (anteilig/kostenlos) und Einrichtungsgebühr im ersten bezahlten Monat. */
export async function monthInvoice(t: Pick<Tenant, "id" | "trialStartedAt" | "trialEndsAt" | "createdAt" | "timezone">, plan: EffectivePlan, usage: Usage, year: number, month: number) {
  const { start, end } = monthRange(year, month, t.timezone);
  const adj = await applyTrialToMonth(t, plan, usage, start, end);
  const firstPaid = zonedParts(t.trialEndsAt && t.trialEndsAt > t.createdAt ? t.trialEndsAt : t.createdAt, t.timezone);
  const invoice = invoiceFor(adj.plan, adj.usage, { includeSetupFee: firstPaid.year === year && firstPaid.month === month });
  if (adj.note) invoice.lines.unshift({ label: adj.note, quantity: 1, unit: "Hinweis", unitCents: 0, totalCents: 0 });
  return { plan: adj.plan, usage: adj.usage, invoice };
}
