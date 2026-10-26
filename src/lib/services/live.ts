import { prisma } from "../db";
import { HttpError } from "../http";
import { logger } from "../logger";
import { normalizePhone } from "../phone";
import { redirectCall } from "../voice/transfer";

type Args = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const LABEL: Record<string, string> = {
  save_customer: "Kundendaten erfasst", find_technician: "Zuständigkeit und Termine gesucht", book_appointment: "Termin bzw. Anliegen gespeichert",
  escalate_emergency: "Notfall ausgelöst", transfer_call: "Durchstellen angefordert", find_appointments: "Termine des Anrufers abgefragt",
  reschedule_appointment: "Termin verschieben", cancel_appointment: "Termin absagen", recording_consent: "Einwilligung Aufzeichnung", check_availability: "Verfügbarkeit geprüft",
};

/** Was die Konsole zeigt: Name, PLZ, Anliegen, Dringlichkeit, Termin, Zuständigkeit – aus Argumenten und Ergebnis. */
export function describeTool(tool: string, args: Args, result: Args): { text: string; data: Record<string, string> } {
  const data: Record<string, string> = {};
  const put = (k: string, v: unknown) => { const x = s(v); if (x) data[k] = x.slice(0, 200); };
  put("name", args.name); put("company", args.companyName); put("postalCode", args.postalCode); put("address", args.address);
  put("category", args.category ?? args.pestType); put("urgency", result.urgency ?? args.urgency); put("description", args.description);
  put("employee", result.employee); put("appointment", result.appointment ?? args.appointmentStart); put("reference", result.reference);
  if (typeof args.smsConsent === "boolean") data.smsConsent = args.smsConsent ? "ja" : "nein";
  const say = s(result.say) ?? s(result.error);
  return { text: `${LABEL[tool] ?? tool}${say ? ` – ${say.slice(0, 280)}` : ""}`, data };
}

/** Funktionsaufruf für die Live-Konsole festhalten (Fehler hier dürfen das Gespräch nie stören). */
export async function recordActivity(callRowId: string | null, tenantId: string, tool: string, args: Args, result: unknown) {
  if (!callRowId) return;
  try {
    const { text, data } = describeTool(tool, args ?? {}, (result && typeof result === "object" ? result : {}) as Args);
    await prisma.callActivity.create({ data: { callId: callRowId, tenantId, tool, text, data } });
  } catch (e) {
    logger.warn("live.activity_failed", { error: (e as Error).message });
  }
}

/** Laufende Gespräche des Betriebs mit Mitschrift (falls der Anbieter sie live liefert) und erkannten Daten. */
export async function liveCalls(tenantId: string) {
  const calls = await prisma.call.findMany({
    where: { tenantId, endedAt: null, status: { in: ["RINGING", "IN_PROGRESS"] }, startedAt: { gte: new Date(Date.now() - 90 * 60_000) } },
    orderBy: { startedAt: "asc" },
    take: 20,
    select: { id: true, provider: true, fromNumber: true, startedAt: true, status: true, transcript: true, twilioCallSid: true, customer: { select: { id: true, name: true, companyName: true } }, activities: { orderBy: { createdAt: "asc" }, select: { id: true, tool: true, text: true, data: true, createdAt: true } } },
  });
  return calls.map((c) => {
    const merged: Record<string, string> = {};
    for (const a of c.activities) Object.assign(merged, a.data as Record<string, string>);
    return {
      id: c.id, provider: c.provider, fromNumber: c.fromNumber, startedAt: c.startedAt, status: c.status, customer: c.customer,
      transcript: c.transcript, liveTranscript: c.provider !== "elevenlabs", canTakeOver: !!c.twilioCallSid,
      detected: merged, activities: c.activities.map(({ data: _d, ...a }) => a),
    };
  });
}

/** Gespräch übernehmen: Twilio leitet den Anrufer sofort auf die angegebene Nummer um, die KI ist danach getrennt. */
export async function takeOver(tenantId: string, callId: string, rawNumber: string) {
  const call = await prisma.call.findFirst({ where: { id: callId, tenantId }, select: { id: true, endedAt: true, twilioCallSid: true } });
  if (!call) throw new HttpError(404, "Gespräch nicht gefunden.");
  if (call.endedAt) throw new HttpError(409, "Das Gespräch ist bereits beendet.");
  if (!call.twilioCallSid) throw new HttpError(409, "Dieses Gespräch kam nicht über Twilio – Übernehmen ist hier nicht möglich.");
  const number = normalizePhone(rawNumber);
  if (!number) throw new HttpError(400, "Bitte eine gültige Telefonnummer angeben.");
  const ok = await redirectCall(call.id, number, { intro: "Einen Moment bitte, ich verbinde Sie jetzt mit einem Kollegen.", delayMs: 0 });
  if (!ok) throw new HttpError(409, "Übernehmen ist gerade nicht möglich (Twilio nicht eingerichtet oder Zielland nicht freigegeben).");
  await prisma.callActivity.create({ data: { callId: call.id, tenantId, tool: "takeover", text: `Gespräch übernommen – weitergeleitet an ${number.slice(0, -3)}***` } });
  return { number };
}

/** Löschjob: Live-Aktivitäten nach 2 Tagen (das Gespräch selbst unterliegt der normalen Löschfrist). */
export async function purgeCallActivities(now = new Date()) {
  return (await prisma.callActivity.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 86400_000) } } })).count;
}
