import { prisma } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { runAfterResponse } from "../defer";
import { smsDestinationAllowed } from "../notify";
import { dialNumber, say } from "../twiml";
import { twilioAuth } from "./providers";

/** Zeit, damit die KI ihren letzten Satz noch sprechen kann, bevor Twilio umleitet */
export const TRANSFER_DELAY_MS = 4000;

/**
 * Notfall-Durchstellung über Twilio statt über das `transfer_call` des KI-Anbieters:
 * Die Zielnummer kommt ausschließlich aus unseren Daten (Direktnummer des Notdienstes bzw.
 * Notfallnummer des Kunden), nie aus dem Gespräch. Twilio leitet den laufenden Anruf um –
 * die KI ist danach nicht mehr verbunden. Nur möglich, wenn der Anruf über Twilio kam.
 * Rückgabe: true = Durchstellung geplant (die KI soll transfer_call NICHT aufrufen).
 */
export async function scheduleServerTransfer(callRowId: string | null, number: string): Promise<boolean> {
  return redirectCall(callRowId, number, { intro: "Ich verbinde Sie jetzt mit dem Notdienst.", delayMs: TRANSFER_DELAY_MS });
}

/** Laufenden Twilio-Anruf auf eine Nummer umleiten (Notfall-Durchstellung bzw. Übernehmen in der Live-Konsole). */
export async function redirectCall(callRowId: string | null, number: string, opts: { intro: string; delayMs: number }): Promise<boolean> {
  if (!callRowId || !smsDestinationAllowed(number)) return false;
  const e = env();
  const auth = twilioAuth();
  if (!auth || !e.TWILIO_ACCOUNT_SID) return false;
  const call = await prisma.call.findUnique({ where: { id: callRowId }, select: { twilioCallSid: true, toNumber: true, endedAt: true } });
  if (!call?.twilioCallSid || call.endedAt) return false;
  const twiml =
    `<Response>${say(opts.intro)}${dialNumber(number, call.toNumber || undefined, 30)}` +
    `${say("Leider ist gerade niemand erreichbar. Wir rufen Sie schnellstmöglich zurück. Auf Wiederhören.")}<Hangup/></Response>`;
  runAfterResponse("voice.server_transfer", async () => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Calls/${encodeURIComponent(call.twilioCallSid!)}.json`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Twiml: twiml }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.error("voice.server_transfer_failed", { status: res.status, callRowId });
    else logger.info("voice.server_transfer", { callRowId });
  });
  return true;
}
