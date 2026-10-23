import { prisma } from "../db";
import { parseSettings } from "../tenant/settings";
import { logger } from "../logger";
import { purgeCallAtProviders } from "../voice/providers";

/**
 * Löschfristen (DSGVO): entfernt Transkripte, Zusammenfassungen und Aufnahme-Links
 * älter als retentionDays je Mandant; bereinigt abgelaufene Sitzungen/Tokens und
 * alte Nachrichteninhalte. Vorgänge selbst (Kunde, Termin, Kategorie) bleiben für
 * die Geschäftsdokumentation erhalten.
 */
export async function runRetention() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, settings: true } });
  let calls = 0, tickets = 0, messages = 0, orphanCalls = 0, providerPurged = 0, providerFailed = 0;
  for (const t of tenants) {
    const cutoff = new Date(Date.now() - parseSettings(t.settings).retentionDays * 86400000);
    // Zuerst bei den Anbietern löschen (Aufnahme, Transkript, Anrufprotokoll), max. 200 je Lauf
    const due = await prisma.call.findMany({
      where: { tenantId: t.id, startedAt: { lt: cutoff }, providerPurgedAt: null, status: { notIn: ["RINGING", "IN_PROGRESS"] } },
      select: { id: true, provider: true, providerCallId: true, twilioCallSid: true, recordingUrl: true },
      take: 200,
    });
    for (const c of due) {
      const r = await purgeCallAtProviders(c);
      if (r.ok) {
        await prisma.call.update({ where: { id: c.id }, data: { providerPurgedAt: new Date() } });
        providerPurged++;
      } else providerFailed++;
    }
    calls += (await prisma.call.updateMany({ where: { tenantId: t.id, startedAt: { lt: cutoff }, OR: [{ transcript: { not: null } }, { recordingUrl: { not: null } }] }, data: { transcript: null, recordingUrl: null, summary: null } })).count;
    tickets += (await prisma.callTicket.updateMany({ where: { tenantId: t.id, createdAt: { lt: cutoff }, transcript: { not: null } }, data: { transcript: null } })).count;
    messages += (await prisma.message.updateMany({ where: { tenantId: t.id, createdAt: { lt: cutoff }, body: { not: "" } }, data: { body: "" } })).count;
    // Anrufe ohne Kunden- und Vorgangsbezug (z. B. aufgelegt) ganz entfernen, sobald beim Anbieter gelöscht
    orphanCalls += (await prisma.call.deleteMany({ where: { tenantId: t.id, startedAt: { lt: cutoff }, customerId: null, tickets: { none: {} }, providerPurgedAt: { not: null } } })).count;
  }
  const now = new Date();
  const sessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  const tokens = (await prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400000) } } })).count;
  const audits = (await prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 730 * 86400000) } } })).count;
  const result = { calls, tickets, messages, orphanCalls, providerPurged, providerFailed, sessions, tokens, audits };
  logger.info("retention.done", result);
  return result;
}
