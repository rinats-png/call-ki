import { statfs } from "node:fs/promises";
import { prisma } from "../db";
import { logger } from "../logger";
import { setting } from "../platform/config";
import { MAX_ATTEMPTS, sendEmail, sendSms, emailLayout } from "../notify";
import { xmlEscape as h } from "../twiml";
import { checkTwilioNumbers } from "../voice/twilio-config";
import { createHash } from "node:crypto";

/**
 * Überwachung des Betriebs (Cron alle 5 Minuten, /api/cron/monitor). Prüft, was Kunden
 * unbemerkt schaden würde, und alarmiert die Plattform-Betreiber. Alarme enthalten
 * keine personenbezogenen Daten (keine Rufnummern, Namen oder Gesprächsinhalte).
 */
export type Finding = { id: string; level: "critical" | "warning"; title: string; detail: string };

const H = 3600_000;
/** Derselbe Alarm höchstens so oft (solange der Zustand anhält) */
const REPEAT_MS = { critical: 1 * H, warning: 6 * H };
/** Ein laufender Anruf ohne Ende-Ereignis gilt danach als hängend */
const HANGING_AFTER_MS = 2 * H;
/** Spätestens so alt darf das letzte erfolgreiche Backup sein */
const BACKUP_MAX_AGE_MS = 26 * H;

export async function recordHeartbeat(job: string, ok: boolean, note = "") {
  const value = JSON.stringify({ ok, at: new Date().toISOString(), note: note.slice(0, 200) });
  await prisma.systemState.upsert({ where: { key: `heartbeat:${job}` }, create: { key: `heartbeat:${job}`, value }, update: { value } });
}

async function heartbeat(job: string): Promise<{ ok: boolean; at: Date; note: string } | null> {
  const row = await prisma.systemState.findUnique({ where: { key: `heartbeat:${job}` } });
  if (!row) return null;
  try {
    const v = JSON.parse(row.value) as { ok: boolean; at: string; note?: string };
    return { ok: v.ok, at: new Date(v.at), note: v.note ?? "" };
  } catch {
    return null;
  }
}

export async function collectFindings(now = new Date()): Promise<Finding[]> {
  const out: Finding[] = [];
  const since24h = new Date(now.getTime() - 24 * H);
  const tenantName = async (id: string | null) => (id ? (await prisma.tenant.findUnique({ where: { id }, select: { name: true } }))?.name ?? "?" : "Plattform");

  // 1) Notfall-Alarme, die endgültig nicht zugestellt wurden oder gar nicht versendet werden konnten
  for (const [status, why] of [["FAILED", "endgültig fehlgeschlagen"], ["SKIPPED", "nicht versendet – Versanddienst nicht eingerichtet"]] as const) {
    const where = { purpose: "EMERGENCY_ALERT", status, createdAt: { gte: since24h }, ...(status === "FAILED" ? { nextAttemptAt: null, attempts: { gte: MAX_ATTEMPTS } } : {}) };
    const n = await prisma.message.count({ where });
    if (n) {
      const last = await prisma.message.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true, tenantId: true, channel: true, error: true } });
      out.push({ id: `emergency-${status.toLowerCase()}:${last!.id}`, level: "critical", title: `Notfall-Alarm ${why}`, detail: `${n} Notfall-Alarm(e) in 24 Std., zuletzt bei „${await tenantName(last!.tenantId)}“ (${last!.channel}${last!.error ? `: ${last!.error.slice(0, 120)}` : ""}). Notdienst sofort anders informieren.` });
    }
  }

  // 2) Übrige Nachrichten, die nach allen Versuchen nicht zugestellt wurden (Alarme selbst ausgenommen)
  const gaveUp = { purpose: { notIn: ["EMERGENCY_ALERT", "PLATFORM_ALERT"] }, status: "FAILED", nextAttemptAt: null, attempts: { gte: MAX_ATTEMPTS }, createdAt: { gte: since24h } };
  const nGaveUp = await prisma.message.count({ where: gaveUp });
  if (nGaveUp) {
    const last = await prisma.message.findFirst({ where: gaveUp, orderBy: { createdAt: "desc" }, select: { id: true, error: true } });
    out.push({ id: `messages-gave-up:${last!.id}`, level: "warning", title: "Nachrichten nicht zustellbar", detail: `${nGaveUp} E-Mail/SMS in 24 Std. nach ${MAX_ATTEMPTS} Versuchen aufgegeben. Letzter Fehler: ${last!.error?.slice(0, 160) ?? "–"}` });
  }

  // 3) Viele Fehlschläge in der letzten Stunde → Integration gestört (SMTP, Twilio …)
  const failingHour = await prisma.message.count({ where: { status: "FAILED", purpose: { not: "PLATFORM_ALERT" }, createdAt: { gte: new Date(now.getTime() - H) } } });
  if (failingHour >= 10) out.push({ id: `messages-failing:${now.toISOString().slice(0, 13)}`, level: "warning", title: "Versand gestört", detail: `${failingHour} fehlgeschlagene Nachrichten in der letzten Stunde. SMTP- bzw. Twilio-Zugang prüfen.` });

  // 4) Hängende Anrufe: kein Gesprächsende gemeldet → weder abgerechnet noch beim Anbieter gelöscht
  const hanging = { endedAt: null, status: { in: ["RINGING", "IN_PROGRESS"] }, startedAt: { lt: new Date(now.getTime() - HANGING_AFTER_MS), gte: new Date(now.getTime() - 7 * 24 * H) } };
  const nHanging = await prisma.call.count({ where: hanging });
  if (nHanging) {
    const last = await prisma.call.findFirst({ where: hanging, orderBy: { startedAt: "desc" }, select: { id: true, provider: true } });
    out.push({ id: `calls-hanging:${last!.id}`, level: "warning", title: "Anrufe ohne Gesprächsende", detail: `${nHanging} Anruf(e) seit über 2 Std. ohne Ende-Ereignis (zuletzt ${last!.provider}). Ereignis-Webhook beim Anbieter prüfen – sonst fehlen Abrechnung und Löschung.` });
  }

  // 4b) Anrufe, deren Ende nur Twilio gemeldet hat → Ereignis-Webhook des KI-Anbieters fehlt oder ist falsch
  const noEvent = { endReason: "no_provider_event", endedAt: { gte: since24h } };
  const nNoEvent = await prisma.call.count({ where: noEvent });
  if (nNoEvent >= 3) {
    const last = await prisma.call.findFirst({ where: noEvent, orderBy: { endedAt: "desc" }, select: { id: true, provider: true } });
    out.push({ id: `calls-no-provider-event:${last!.id}`, level: "warning", title: "KI-Anbieter meldet Gesprächsende nicht", detail: `${nNoEvent} Anrufe in 24 Std. ohne Ereignis vom Anbieter (zuletzt ${last!.provider}). Transkript und Zusammenfassung fehlen; Ereignis-URL und Geheimnis beim Anbieter prüfen.` });
  }

  // 5) Backup: letztes erfolgreiches Backup zu alt oder letzter Lauf fehlgeschlagen
  if (setting("BACKUP_EXPECTED") === "true") {
    const hb = await heartbeat("backup");
    if (!hb || now.getTime() - hb.at.getTime() > BACKUP_MAX_AGE_MS) {
      out.push({ id: `backup-missing:${now.toISOString().slice(0, 10)}`, level: "critical", title: "Kein aktuelles Backup", detail: hb ? `Letzte Meldung des Backups: ${hb.at.toISOString()}.` : "Das Backup hat sich noch nie gemeldet." });
    } else if (!hb.ok) {
      out.push({ id: `backup-failed:${hb.at.toISOString()}`, level: "critical", title: "Backup fehlgeschlagen", detail: `Backup-Lauf ${hb.at.toISOString()}: ${hb.note || "Fehler"}` });
    }
  }

  // 5b) Wiederherstellungstest: monatlich automatisch; älter als 35 Tage oder fehlgeschlagen → Warnung
  if (setting("BACKUP_EXPECTED") === "true") {
    const rt = await heartbeat("restore-test");
    if (rt && !rt.ok) out.push({ id: `restore-test-failed:${rt.at.toISOString()}`, level: "critical", title: "Wiederherstellungstest fehlgeschlagen", detail: `${rt.at.toISOString()}: ${rt.note || "Fehler"}. Backups sind möglicherweise nicht nutzbar.` });
    else if (!rt || now.getTime() - rt.at.getTime() > 35 * 24 * H) out.push({ id: `restore-test-missing:${now.toISOString().slice(0, 7)}`, level: "warning", title: "Wiederherstellungstest überfällig", detail: rt ? `Letzter erfolgreicher Test: ${rt.at.toISOString()}.` : "Noch kein Wiederherstellungstest gemeldet. Von Hand: docker compose exec backup sh /deploy/restore-test.sh" });
  }

  // 5c) Twilio-Rufnummern: Anrufziel, unabhängiges Ersatzziel, Weiterleitungsnummer (höchstens stündlich prüfen)
  const lastCheck = await prisma.systemState.findUnique({ where: { key: "check:twilio-numbers" } });
  if (!lastCheck || now.getTime() - new Date(lastCheck.value).getTime() >= H) {
    await prisma.systemState.upsert({ where: { key: "check:twilio-numbers" }, create: { key: "check:twilio-numbers", value: now.toISOString() }, update: { value: now.toISOString() } });
    try {
      const r = await checkTwilioNumbers();
      if (r?.problems.length) {
        const hash = createHash("sha256").update(r.problems.join("|")).digest("hex").slice(0, 12);
        out.push({ id: `twilio-numbers:${hash}`, level: "warning", title: "Rufnummern bei Twilio unvollständig eingerichtet", detail: r.problems.slice(0, 10).join(" · ") + (r.problems.length > 10 ? ` · und ${r.problems.length - 10} weitere` : "") });
      }
    } catch (err) {
      out.push({ id: `twilio-check-failed:${now.toISOString().slice(0, 10)}`, level: "warning", title: "Twilio-Prüfung fehlgeschlagen", detail: (err as Error).message.slice(0, 200) });
    }
  }

  // 6) Plattenplatz
  try {
    const fs = await statfs("/");
    const free = fs.bavail / fs.blocks;
    if (free < 0.1) out.push({ id: `disk:${free < 0.05 ? "critical" : "warning"}`, level: free < 0.05 ? "critical" : "warning", title: "Wenig Speicherplatz", detail: `Noch ${(free * 100).toFixed(1)} % frei (${Math.round((fs.bavail * fs.bsize) / 1e9)} GB).` });
  } catch {
    /* statfs nicht verfügbar – keine Aussage */
  }
  return out;
}

/** Sendet einen Alarm über alle eingerichteten Wege. Gibt zurück, ob mindestens ein Weg eingerichtet ist. */
async function deliverAlert(f: Finding): Promise<boolean> {
  const subject = `${f.level === "critical" ? "🚨 KRITISCH" : "⚠ Warnung"}: ${f.title}`;
  let channels = 0;
  const webhook = setting("ALERT_WEBHOOK_URL");
  if (webhook) {
    channels++;
    try {
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `${subject}\n${f.detail}`, level: f.level, id: f.id }), signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      logger.error("alert.webhook_failed", { error: (err as Error).message });
    }
  }
  const emails = (setting("ALERT_EMAIL") ?? "").split(/[,;\s]+/).filter(Boolean);
  const recipients = emails.length ? emails : (await prisma.user.findMany({ where: { role: "PLATFORM_ADMIN", disabled: false }, select: { email: true } })).map((u) => u.email);
  for (const to of recipients) {
    channels++;
    await sendEmail({ to, subject, html: emailLayout(`<p><b>${h(f.title)}</b></p><p>${h(f.detail)}</p>`, "Automatische Überwachung der KI-Telefonzentrale"), purpose: "PLATFORM_ALERT" });
  }
  const sms = setting("ALERT_SMS");
  if (sms && f.level === "critical") {
    channels++;
    await sendSms({ tenantId: null, to: sms, body: `${subject}. ${f.detail}`.slice(0, 300), purpose: "PLATFORM_ALERT" });
  }
  return channels > 0;
}

/** Alarm senden, außer derselbe Befund wurde vor Kurzem schon gemeldet. true = gesendet. */
export async function alertOnce(f: Finding, now = new Date()): Promise<boolean> {
  logger[f.level === "critical" ? "error" : "warn"]("monitor.finding", { id: f.id, title: f.title });
  const key = `alert:${f.id}`;
  const last = await prisma.systemState.findUnique({ where: { key } });
  if (last && now.getTime() - new Date(last.value).getTime() < REPEAT_MS[f.level]) return false;
  const sent = await deliverAlert(f);
  await prisma.systemState.upsert({ where: { key }, create: { key, value: now.toISOString() }, update: { value: now.toISOString() } });
  return sent;
}

/** Ein Monitoring-Lauf: prüfen, neue bzw. fällige Alarme senden, Lebenszeichen an externen Dienst. */
export async function runMonitor(now = new Date()) {
  const findings = await collectFindings(now);
  let alerted = 0;
  for (const f of findings) if (await alertOnce(f, now)) alerted++;
  // Alte Alarm-Merker aufräumen
  await prisma.systemState.deleteMany({ where: { key: { startsWith: "alert:" }, updatedAt: { lt: new Date(now.getTime() - 7 * 24 * H) } } });

  // Lebenszeichen nach außen (z. B. healthchecks.io): bleibt es aus, alarmiert der externe Dienst –
  // auch wenn der ganze Server ausgefallen ist.
  const ping = setting("HEALTHCHECK_PING_URL");
  if (ping) {
    const critical = findings.some((f) => f.level === "critical");
    await fetch(critical ? `${ping.replace(/\/$/, "")}/fail` : ping, { method: "POST", body: findings.map((f) => f.title).join("\n"), signal: AbortSignal.timeout(10_000) }).catch((err) => logger.warn("monitor.ping_failed", { error: (err as Error).message }));
  }
  return { findings: findings.map(({ id, level, title }) => ({ id, level, title })), alerted };
}
