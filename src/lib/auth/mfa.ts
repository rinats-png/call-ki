import { prisma } from "../db";
import { open } from "../secret-box";
import { sha256 } from "./crypto";
import { normalizeRecoveryCode, verifyTotp } from "./totp";

/**
 * Prüft einen TOTP- oder Wiederherstellungscode für einen Nutzer mit aktiver 2FA.
 * TOTP: Wiederverwendung desselben Zeitschritts wird abgelehnt.
 * Wiederherstellungscode: wird nach Benutzung entwertet.
 */
export async function verifySecondFactor(userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true, recoveryCodes: true } });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) return null;
  const clean = code.trim();

  if (/^\d{6}$/.test(clean.replace(/\s/g, ""))) {
    const step = verifyTotp(open(user.totpSecretEnc), clean, { lastStep: user.totpLastStep });
    if (step == null) return null;
    // Atomar: nur übernehmen, wenn der Schritt noch nicht genutzt wurde
    const r = await prisma.user.updateMany({ where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    return r.count ? "totp" : null;
  }

  const h = sha256(normalizeRecoveryCode(clean));
  if (!user.recoveryCodes.includes(h)) return null;
  await prisma.user.update({ where: { id: userId }, data: { recoveryCodes: user.recoveryCodes.filter((c) => c !== h) } });
  return "recovery";
}
