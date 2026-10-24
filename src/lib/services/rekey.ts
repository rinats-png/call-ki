import { prisma } from "../db";
import { logger } from "../logger";
import { needsReseal, open, seal } from "../secret-box";

/**
 * Verschlüsselt alle gespeicherten Geheimnisse mit dem aktuellen APP_ENCRYPTION_KEY neu
 * (TOTP-Secrets, geheime Plattform-Einstellungen, Google-Refresh-Tokens, Webhook-Geheimnisse). Läuft täglich im
 * Löschfristen-Job und auf Abruf über /api/cron/rekey. Erst wenn `remaining` 0 ist, darf der
 * alte Schlüssel aus APP_ENCRYPTION_KEYS_OLD entfernt werden.
 */
export async function resealAll() {
  let resealed = 0, failed = 0;
  const redo = async (value: string, write: (v: string) => Promise<unknown>) => {
    if (!needsReseal(value)) return;
    try {
      await write(seal(open(value)));
      resealed++;
    } catch {
      failed++;
    }
  };
  for (const u of await prisma.user.findMany({ where: { totpSecretEnc: { not: null } }, select: { id: true, totpSecretEnc: true } })) {
    await redo(u.totpSecretEnc!, (v) => prisma.user.update({ where: { id: u.id }, data: { totpSecretEnc: v } }));
  }
  for (const s of await prisma.platformSetting.findMany({ where: { secret: true }, select: { key: true, value: true } })) {
    await redo(s.value, (v) => prisma.platformSetting.update({ where: { key: s.key }, data: { value: v } }));
  }
  for (const i of await prisma.integration.findMany({ where: { secretEnc: { not: null } }, select: { id: true, secretEnc: true } })) {
    await redo(i.secretEnc!, (v) => prisma.integration.update({ where: { id: i.id }, data: { secretEnc: v } }));
  }
  for (const w of await prisma.webhookEndpoint.findMany({ select: { id: true, secretEnc: true } })) {
    await redo(w.secretEnc, (v) => prisma.webhookEndpoint.update({ where: { id: w.id }, data: { secretEnc: v } }));
  }
  const remaining =
    (await prisma.user.findMany({ where: { totpSecretEnc: { not: null } }, select: { totpSecretEnc: true } })).filter((u) => needsReseal(u.totpSecretEnc!)).length +
    (await prisma.platformSetting.findMany({ where: { secret: true }, select: { value: true } })).filter((s) => needsReseal(s.value)).length +
    (await prisma.integration.findMany({ where: { secretEnc: { not: null } }, select: { secretEnc: true } })).filter((i) => needsReseal(i.secretEnc!)).length +
    (await prisma.webhookEndpoint.findMany({ select: { secretEnc: true } })).filter((w) => needsReseal(w.secretEnc)).length;
  if (resealed || failed) logger.info("secrets.resealed", { resealed, failed, remaining });
  if (failed) logger.error("secrets.reseal_failed", { failed, hint: "Wert mit keinem bekannten Schlüssel lesbar – alten Schlüssel in APP_ENCRYPTION_KEYS_OLD ergänzen" });
  return { resealed, failed, remaining };
}
