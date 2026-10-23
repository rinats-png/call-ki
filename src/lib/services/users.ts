import { prisma } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../auth/crypto";
import { emailLayout, sendEmail } from "../notify";
import { xmlEscape as h } from "../twiml";

const INVITE_DAYS = 7;
const RESET_HOURS = 2;

/** Erstellt einen Einmal-Link (Einladung / Passwort-Reset). Der Klartext-Token existiert nur im Link. */
export async function createAuthLink(userId: string, type: "INVITE" | "PASSWORD_RESET"): Promise<string> {
  const token = randomToken();
  const ttl = type === "INVITE" ? INVITE_DAYS * 86400_000 : RESET_HOURS * 3600_000;
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }); // alte Links entwerten
  await prisma.authToken.create({ data: { id: sha256(token), userId, type, expiresAt: new Date(Date.now() + ttl) } });
  const path = type === "INVITE" ? "invite" : "reset";
  return `${env().PUBLIC_BASE_URL.replace(/\/$/, "")}/${path}/${token}`;
}

export async function consumeAuthToken(token: string, type: "INVITE" | "PASSWORD_RESET") {
  const rec = await prisma.authToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!rec || rec.type !== type || rec.usedAt || rec.expiresAt < new Date()) return null;
  return rec;
}

export async function sendInviteEmail(user: { id: string; email: string; name: string | null; tenantId: string | null }, tenantName: string | null) {
  const link = await createAuthLink(user.id, "INVITE");
  const platform = env().PLATFORM_NAME;
  await sendEmail({
    tenantId: user.tenantId,
    to: user.email,
    purpose: "INVITE",
    subject: `Ihr Zugang zur ${platform}${tenantName ? ` – ${tenantName}` : ""}`,
    html: emailLayout(
      `<p>Guten Tag${user.name ? ` ${h(user.name)}` : ""},</p>` +
        `<p>für Sie wurde ein Zugang zur ${h(platform)}${tenantName ? ` für <b>${h(tenantName)}</b>` : ""} eingerichtet.</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#2f5fd0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Passwort festlegen</a></p>` +
        `<p style="color:#6b7484;font-size:12px">Der Link ist ${INVITE_DAYS} Tage gültig.</p>`,
      platform,
    ),
  });
  return link;
}

export async function sendPasswordResetEmail(user: { id: string; email: string; tenantId: string | null }) {
  const link = await createAuthLink(user.id, "PASSWORD_RESET");
  const platform = env().PLATFORM_NAME;
  await sendEmail({
    tenantId: user.tenantId,
    to: user.email,
    purpose: "PASSWORD_RESET",
    subject: `Passwort zurücksetzen – ${platform}`,
    html: emailLayout(
      `<p>Sie haben das Zurücksetzen Ihres Passworts angefordert.</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#2f5fd0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Neues Passwort festlegen</a></p>` +
        `<p style="color:#6b7484;font-size:12px">Der Link ist ${RESET_HOURS} Stunden gültig. Falls Sie das nicht waren, ignorieren Sie diese E-Mail.</p>`,
      platform,
    ),
  });
  return link;
}
