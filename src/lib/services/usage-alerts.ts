import { prisma } from "../db";
import { logger } from "../logger";
import { settingNumber } from "../platform/config";
import { currentMonth, effectivePlan, usageForMonth } from "../billing";
import { emailLayout, sendEmail } from "../notify";
import { xmlEscape as h } from "../twiml";
import { fromZoned, zonedParts } from "../time";
import { alertOnce } from "./monitor";

/**
 * Kontingent-Warnungen bei 80 % und 100 % (E-Mail an die Administratoren des Kunden) und
 * Plattform-Alarme bei ungewöhnlichem Verbrauch bzw. erreichtem Tagesbudget.
 * Jede Schwelle wird je Kunde und Monat nur einmal gemeldet (SystemState).
 */
const THRESHOLDS = [80, 100] as const;

export async function runQuotaWarnings(now = new Date()) {
  const tenants = await prisma.tenant.findMany({ where: { status: { not: "PAUSED" } }, include: { planRef: true } });
  let sent = 0;
  for (const t of tenants) {
    const plan = effectivePlan(t, t.planRef);
    // Bezugsgröße: harte Kostenbremse des Kunden, sonst Freiminuten des Pakets
    const limit = t.monthlyMinuteLimit ?? (plan.planId && plan.includedMinutes > 0 ? plan.includedMinutes : null);
    if (!limit) continue;
    const { year, month } = currentMonth(t.timezone);
    const usage = await usageForMonth(t, year, month, plan.billingIncrementSec);
    const pct = (usage.minutes / limit) * 100;
    const ym = `${year}-${String(month).padStart(2, "0")}`;

    for (const th of THRESHOLDS) {
      if (pct < th) continue;
      const key = `quota:${t.id}:${ym}:${th}`;
      if (await prisma.systemState.findUnique({ where: { key } })) continue;
      await prisma.systemState.create({ data: { key, value: now.toISOString() } });
      const blocks = t.monthlyMinuteLimit != null || plan.overageMode === "BLOCK";
      const what = t.monthlyMinuteLimit != null ? "Ihrer Minutengrenze" : "Ihrer Freiminuten";
      const consequence =
        th < 100
          ? blocks
            ? "Ist das Kontingent aufgebraucht, nimmt die KI keine Anrufe mehr an; Anrufe gehen dann an Ihre Weiterleitungsnummer bzw. die Mailbox."
            : `Danach berechnen wir jede weitere Minute mit ${(plan.overageCentsPerMinute / 100).toFixed(2).replace(".", ",")} € netto.`
          : blocks
            ? "Das Kontingent ist aufgebraucht: Die KI nimmt bis zum Monatsende keine Anrufe mehr an. Anrufe gehen an Ihre Weiterleitungsnummer bzw. die Mailbox. Für mehr Minuten melden Sie sich bitte bei uns."
            : `Ab jetzt berechnen wir jede weitere Minute mit ${(plan.overageCentsPerMinute / 100).toFixed(2).replace(".", ",")} € netto.`;
      const subject = `${th} % ${what} verbraucht`;
      const html = emailLayout(
        `<p>Guten Tag,</p><p>im laufenden Monat hat die KI-Telefonzentrale für <b>${h(t.name)}</b> <b>${Math.floor(usage.minutes)} von ${limit} Minuten</b> (${Math.floor(pct)} %) ${h(what)} genutzt.</p><p>${h(consequence)}</p>`,
        "Automatische Nachricht der KI-Telefonzentrale",
      );
      const admins = await prisma.user.findMany({ where: { tenantId: t.id, role: "TENANT_ADMIN", disabled: false }, select: { email: true } });
      for (const a of admins) await sendEmail({ tenantId: t.id, to: a.email, subject, html, purpose: "QUOTA_WARNING" });
      sent++;
      logger.info("quota.warning", { tenantId: t.id, threshold: th, minutes: usage.minutes, limit });
      if (th === 100) await alertOnce({ id: `quota-100:${t.id}:${ym}`, level: "warning", title: "Kontingent eines Kunden aufgebraucht", detail: `„${t.name}“: ${Math.floor(usage.minutes)} von ${limit} Minuten (${blocks ? "KI gesperrt bis Monatsende" : "weitere Minuten werden berechnet"}).` }, now);
    }
    // Ohne harte Grenze (Modus CHARGE): ungewöhnlich hoher Verbrauch an den Betreiber melden
    if (t.monthlyMinuteLimit == null && plan.overageMode === "CHARGE" && pct >= 200) {
      await alertOnce({ id: `quota-200:${t.id}:${ym}`, level: "warning", title: "Ungewöhnlich hoher Verbrauch", detail: `„${t.name}“ liegt bei ${Math.floor(pct)} % der Freiminuten und hat keine Minutengrenze. Missbrauch ausschließen, ggf. Grenze setzen.` }, now);
    }
  }

  // Tagesbudget der Plattform (Kostenbremse): ab 80 % Warnung, ab 100 % kritisch – neue Anrufe gehen dann an den Fallback
  const daily = settingNumber("PLATFORM_DAILY_MINUTE_LIMIT", 0);
  if (daily > 0) {
    const p = zonedParts(now, "Europe/Berlin");
    const start = fromZoned(p.year, p.month, p.day, 0, 0, "Europe/Berlin");
    const agg = await prisma.call.aggregate({ where: { startedAt: { gte: start } }, _sum: { durationSec: true } });
    const minutes = (agg._sum.durationSec ?? 0) / 60;
    const day = start.toISOString().slice(0, 10);
    if (minutes >= daily) await alertOnce({ id: `platform-budget-100:${day}`, level: "critical", title: "Tagesbudget der Plattform erreicht", detail: `${Math.floor(minutes)} von ${daily} Minuten heute. Neue Anrufe gehen bis Mitternacht an Fallback-Nummern bzw. Mailbox.` }, now);
    else if (minutes >= daily * 0.8) await alertOnce({ id: `platform-budget-80:${day}`, level: "warning", title: "Tagesbudget der Plattform zu 80 % verbraucht", detail: `${Math.floor(minutes)} von ${daily} Minuten heute.` }, now);
  }
  return { tenants: tenants.length, warnings: sent };
}
