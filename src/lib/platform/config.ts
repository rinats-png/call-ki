import { prisma } from "../db";
import { logger } from "../logger";
import { open, seal } from "../secret-box";
import { getOverlay, setOverlay } from "./overlay";
import { SETTING_KEYS, SECRET_KEYS } from "./registry";

/**
 * Plattform-Einstellungen aus der Oberfläche (Tabelle PlatformSetting). Sie überlagern
 * gleichnamige Umgebungsvariablen; die .env bleibt Rückfallebene (z. B. für den VPS-Start).
 * Werte werden im Prozess zwischengespeichert und spätestens nach TTL neu geladen.
 */
const TTL_MS = 30_000;
let loadedAt = 0;
let loading: Promise<void> | null = null;


/** Lädt die Einstellungen (einmal je TTL). Wird von allen API-Routen vor der Verarbeitung aufgerufen. */
export async function ensurePlatformConfig(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const rows = await prisma.platformSetting.findMany();
      const next: Record<string, string> = {};
      for (const r of rows) {
        try {
          next[r.key] = r.secret ? open(r.value) : r.value;
        } catch (err) {
          logger.error("platform_setting.decrypt_failed", { key: r.key, error: (err as Error).message });
        }
      }
      setOverlay(next);
      loadedAt = Date.now();
    } catch (err) {
      // Datenbank nicht erreichbar → mit bisherigen Werten bzw. .env weiterarbeiten
      logger.error("platform_setting.load_failed", { error: (err as Error).message });
      loadedAt = Date.now() - TTL_MS + 5_000;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Wert einer Einstellung: Oberfläche vor Umgebungsvariable. */
export function setting(key: string): string | undefined {
  const v = getOverlay()[key] ?? process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

export function settingNumber(key: string, fallback: number): number {
  const n = Number(setting(key));
  return Number.isFinite(n) ? n : fallback;
}

export type SettingState = { key: string; set: boolean; source: "ui" | "env" | null; value?: string; hint?: string };

/** Zustand aller bekannten Einstellungen für die Oberfläche – Geheimnisse nie im Klartext. */
export async function describeSettings(): Promise<Record<string, SettingState>> {
  await ensurePlatformConfig(true);
  const out: Record<string, SettingState> = {};
  for (const key of SETTING_KEYS) {
    const ui = getOverlay()[key];
    const env = process.env[key];
    const v = ui ?? (env || undefined);
    const source = ui !== undefined ? "ui" : env ? "env" : null;
    if (SECRET_KEYS.has(key)) out[key] = { key, set: !!v, source, hint: v ? `••••${v.slice(-4)}` : undefined };
    else out[key] = { key, set: !!v, source, value: v ?? "" };
  }
  return out;
}

/** Speichert oder entfernt (value = null/"") eine Einstellung. Nur Schlüssel aus der Registry. */
export async function saveSetting(key: string, value: string | null, userId: string): Promise<void> {
  if (!SETTING_KEYS.has(key)) throw new Error(`Unbekannte Einstellung: ${key}`);
  const secret = SECRET_KEYS.has(key);
  if (value === null || value.trim() === "") {
    await prisma.platformSetting.deleteMany({ where: { key } });
  } else {
    const v = value.trim();
    const stored = secret ? seal(v) : v;
    await prisma.platformSetting.upsert({ where: { key }, create: { key, value: stored, secret, updatedBy: userId }, update: { value: stored, secret, updatedBy: userId } });
  }
  await ensurePlatformConfig(true);
}
