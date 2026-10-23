import { dialNumber, say, twimlResponse, xmlEscape } from "../twiml";

/**
 * Fallback, wenn die KI nicht verfügbar ist (Störung, Kontingent erschöpft, Mandant pausiert):
 * Weiterleitung an die Fallback-Nummer des Mandanten, sonst Mailbox → Rückruf-Ticket.
 */
export function fallbackTwiml(opts: { companyName?: string; fallbackNumber?: string | null; callerId?: string; recordingAction?: string }) {
  const name = opts.companyName ?? "uns";
  if (opts.fallbackNumber) {
    return twimlResponse(say(`Willkommen bei ${name}. Einen Moment bitte, wir verbinden Sie.`) + dialNumber(opts.fallbackNumber, opts.callerId));
  }
  if (!opts.recordingAction) {
    return twimlResponse(say("Diese Rufnummer ist derzeit nicht erreichbar. Auf Wiederhören.") + "<Hangup/>");
  }
  return twimlResponse(
    say(`Willkommen bei ${name}. Leider ist gerade niemand erreichbar. Bitte hinterlassen Sie nach dem Signalton Ihren Namen, Ihre Adresse und Ihr Anliegen. Wir rufen Sie zurück.`) +
      `<Record maxLength="120" playBeep="true" action="${xmlEscape(opts.recordingAction)}" method="POST" />` +
      say("Wir haben keine Nachricht erhalten. Auf Wiederhören."),
  );
}
