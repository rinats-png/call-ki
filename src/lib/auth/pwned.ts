import crypto from "node:crypto";
import { logger } from "../logger";
import { passwordProblem } from "./crypto";

/**
 * Prüfung gegen bekannte geleakte Passwörter (Have I Been Pwned, Range-API, k-Anonymität):
 * Nur die ersten 5 Zeichen des SHA-1-Hashes verlassen den Server.
 * Fällt der Dienst aus, wird nicht blockiert (fail-open) – die Längenregel gilt weiterhin.
 */
export async function isPwned(password: string): Promise<boolean | null> {
  if (process.env.PWNED_CHECK === "false") return null;
  const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "KI-Telefonzentrale" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch (err) {
    logger.warn("pwned.check_failed", { error: (err as Error).message });
    return null;
  }
}

/** Vollständige Passwortprüfung für neue Passwörter. */
export async function checkNewPassword(password: string): Promise<string | null> {
  const p = passwordProblem(password);
  if (p) return p;
  if (await isPwned(password)) return "Dieses Passwort ist aus Datenlecks bekannt. Bitte wählen Sie ein anderes.";
  return null;
}
