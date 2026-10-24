import { after } from "next/server";
import { logger } from "./logger";

const pending = new Set<Promise<unknown>>();

/**
 * Führt Arbeit nach der Antwort aus (Next.js `after`), damit z. B. die Sprach-KI nicht auf
 * E-Mail- und SMS-Versand wartet. Außerhalb einer Anfrage (Tests, Skripte) startet die
 * Arbeit sofort im Hintergrund. Fehler werden protokolliert, nie weitergeworfen.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>) {
  const run = () => {
    const p: Promise<unknown> = task()
      .catch((err) => logger.error("deferred.failed", { label, error: (err as Error).message }))
      .finally(() => pending.delete(p));
    pending.add(p);
    return p;
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Wartet, bis alle im Hintergrund gestartete Arbeit erledigt ist (für Tests und Skripte). */
export async function settleDeferred() {
  while (pending.size) await Promise.allSettled([...pending]);
}
