/** Minimaler, sicherer TwiML-Builder (kein externes SDK nötig). */
export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function twimlResponse(inner: string, status = 200): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const say = (text: string) => `<Say language="de-DE" voice="Polly.Vicki-Neural">${xmlEscape(text)}</Say>`;

export const dialNumber = (number: string, callerId?: string, timeout = 25) =>
  `<Dial timeout="${timeout}"${callerId ? ` callerId="${xmlEscape(callerId)}"` : ""}>${xmlEscape(number)}</Dial>`;

export const dialSip = (sipUri: string) => `<Dial><Sip>${xmlEscape(sipUri)}</Sip></Dial>`;
