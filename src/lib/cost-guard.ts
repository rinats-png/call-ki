import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import { setting, settingNumber } from "./platform/config";
import { fromZoned, zonedParts } from "./time";

/**
 * Kostenschutz gegen „Denial of Wallet“: Notschalter, Höchstzahl gleichzeitiger Anrufe
 * (je Kunde und gesamt), Tagesbudget der Plattform und maximale Gesprächsdauer.
 * Greift beim Anrufeingang (Twilio) – abgelehnte Anrufe gehen an Fallback-Nummer bzw. Mailbox.
 */

/** Maximale Gesprächsdauer mit der Sprach-KI in Sekunden (Einstellung MAX_CALL_MINUTES, 2–120, Standard 20). */
export function maxCallSeconds(): number {
  return Math.min(120, Math.max(2, settingNumber("MAX_CALL_MINUTES", 20))) * 60;
}

const ACTIVE_STATUSES = ["RINGING", "IN_PROGRESS"];

/** Anrufe, die gerade laufen (ohne Ende-Ereignis, jünger als die Höchstdauer + Puffer). */
function activeWhere(now: Date, tenantId?: string, excludeCallId?: string) {
  return {
    endedAt: null,
    status: { in: ACTIVE_STATUSES },
    startedAt: { gte: new Date(now.getTime() - maxCallSeconds() * 1000 - 5 * 60_000) },
    ...(tenantId ? { tenantId } : {}),
    ...(excludeCallId ? { id: { not: excludeCallId } } : {}),
  };
}

export type Admission = { ok: true } | { ok: false; reason: "kill_switch" | "tenant_concurrency" | "platform_concurrency" | "platform_daily_budget" };

/** Darf dieser Anruf zur Sprach-KI? `callId` = eigene, gerade angelegte Anrufzeile (zählt nicht mit). */
export async function callAdmission(tenantId: string, callId: string, now = new Date()): Promise<Admission> {
  if (setting("AI_KILL_SWITCH") === "on") return { ok: false, reason: "kill_switch" };

  const perTenant = settingNumber("MAX_CONCURRENT_CALLS_PER_TENANT", 5);
  if (perTenant > 0 && (await prisma.call.count({ where: activeWhere(now, tenantId, callId) })) >= perTenant) return { ok: false, reason: "tenant_concurrency" };

  const total = settingNumber("MAX_CONCURRENT_CALLS_TOTAL", 50);
  if (total > 0 && (await prisma.call.count({ where: activeWhere(now, undefined, callId) })) >= total) return { ok: false, reason: "platform_concurrency" };

  const dailyLimit = settingNumber("PLATFORM_DAILY_MINUTE_LIMIT", 0);
  if (dailyLimit > 0) {
    const p = zonedParts(now, "Europe/Berlin");
    const start = fromZoned(p.year, p.month, p.day, 0, 0, "Europe/Berlin");
    const agg = await prisma.call.aggregate({ where: { startedAt: { gte: start } }, _sum: { durationSec: true } });
    if ((agg._sum.durationSec ?? 0) / 60 >= dailyLimit) return { ok: false, reason: "platform_daily_budget" };
  }
  return { ok: true };
}

/**
 * Beendet Gespräche, die die Höchstdauer deutlich überschreiten, über die Twilio-API
 * (greift auch bei Anbietern ohne Dial-timeLimit, z. B. ElevenLabs). Läuft jede Minute.
 */
export async function enforceCallLimits(now = new Date()) {
  const e = env();
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN) return { checked: 0, ended: 0 };
  const overdue = await prisma.call.findMany({
    where: { endedAt: null, status: { in: ACTIVE_STATUSES }, twilioCallSid: { not: null }, startedAt: { lt: new Date(now.getTime() - maxCallSeconds() * 1000 - 2 * 60_000), gte: new Date(now.getTime() - 24 * 3600_000) } },
    select: { id: true, tenantId: true, twilioCallSid: true },
    take: 50,
  });
  const auth = "Basic " + Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
  let ended = 0;
  for (const c of overdue) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Calls/${c.twilioCallSid}.json`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Status: "completed" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        ended++;
        logger.warn("call.max_duration_ended", { tenantId: c.tenantId, callId: c.id });
      } else {
        logger.warn("call.max_duration_end_failed", { callId: c.id, status: res.status });
      }
    } catch (err) {
      logger.warn("call.max_duration_end_failed", { callId: c.id, error: (err as Error).message });
    }
  }
  return { checked: overdue.length, ended };
}
