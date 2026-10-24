import { dialNumber, say } from "../twiml";

/**
 * Ersatzziel bei Twilio („Primary handler fails“), das NICHT von unserem Server abhängt:
 * TwiML für eine TwiML Bin je Rufnummer. Greift, wenn die App nicht antwortet (Serverausfall,
 * Wartung, Netzwerk). Kein Aufruf zurück an unsere Domain – sonst fiele es mit aus.
 */
export function twilioBinTwiml(n: { e164: string; fallbackNumber: string | null }, companyName: string): string {
  const inner = n.fallbackNumber
    ? say(`Willkommen bei ${companyName}. Einen Moment bitte, wir verbinden Sie.`) +
      dialNumber(n.fallbackNumber, n.e164, 30) +
      say("Leider ist gerade niemand erreichbar. Bitte rufen Sie später noch einmal an. Auf Wiederhören.")
    : say(`Willkommen bei ${companyName}. Wir sind gerade technisch nicht erreichbar. Bitte rufen Sie in einigen Minuten noch einmal an. Auf Wiederhören.`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}<Hangup/></Response>`;
}
