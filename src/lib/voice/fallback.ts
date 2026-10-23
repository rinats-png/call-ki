import { env } from "../env";
import { dialNumber, say, twimlResponse } from "../twiml";

/** Fallback, wenn die Sprach-KI nicht erreichbar ist: Weiterleitung ins Büro oder Mailbox. */
export function fallbackTwiml(callerId?: string) {
  const backoffice = env().BACKOFFICE_FALLBACK_NUMBER;
  if (backoffice) {
    return twimlResponse(say("Willkommen bei der Storm GmbH. Einen Moment bitte, wir verbinden Sie mit unserem Team.") + dialNumber(backoffice, callerId));
  }
  return twimlResponse(
    say("Willkommen bei der Storm GmbH. Leider sind gerade alle Leitungen belegt. Bitte hinterlassen Sie nach dem Signalton Ihren Namen, Ihre Adresse und Ihr Anliegen. Wir rufen Sie schnellstmöglich zurück.") +
      `<Record maxLength="120" playBeep="true" action="/api/twilio/recording" method="POST" />` +
      say("Wir haben keine Nachricht erhalten. Auf Wiederhören."),
  );
}
