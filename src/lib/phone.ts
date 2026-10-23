/**
 * Normalisiert deutsche/internationale Rufnummern auf E.164 (+49...),
 * damit Twilio-Caller-IDs und manuell erfasste Nummern zuverlässig matchen.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "49"): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-()./]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    return digits.length >= 6 ? "+" + digits : null;
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length < 6) return null;
  if (digits.startsWith("0")) return "+" + defaultCountryCode + digits.slice(1);
  if (digits.startsWith(defaultCountryCode) && digits.length > 10) return "+" + digits;
  return "+" + defaultCountryCode + digits;
}

/** Maskiert eine Nummer für Logs (DSGVO): +49151****4567 */
export function maskPhone(phone: string): string {
  if (phone.length <= 8) return phone;
  return phone.slice(0, 6) + "****" + phone.slice(-4);
}
