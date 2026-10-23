import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson, HttpError } from "@/lib/http";
import { requirePlatformAdmin, requireRecentAuth } from "@/lib/auth/session";
import { describeSettings, saveSetting } from "@/lib/platform/config";
import { PROVIDERS, SECRET_KEYS, SETTING_KEYS } from "@/lib/platform/registry";
import { webhookUrls } from "@/lib/platform/webhooks";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Alle Plattform-Einstellungen (Geheimnisse nur maskiert) + Webhook-URLs */
export const GET = api(async () => {
  await requirePlatformAdmin();
  return NextResponse.json({ settings: await describeSettings(), webhooks: webhookUrls(), encryption: !!process.env.APP_ENCRYPTION_KEY });
});

const schema = z.object({ key: z.string().refine((k) => SETTING_KEYS.has(k), "Unbekannte Einstellung"), value: z.string().max(4000).nullable() });

export const PUT = api(async (req) => {
  const auth = await requirePlatformAdmin();
  const d = schema.parse(await readJson(req));
  // Zugangsdaten ändern ist sensibel → frische Anmeldung verlangen
  if (SECRET_KEYS.has(d.key)) requireRecentAuth(auth);
  if (SECRET_KEYS.has(d.key) && !process.env.APP_ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
    throw new HttpError(409, "APP_ENCRYPTION_KEY ist auf dem Server nicht gesetzt – Zugangsdaten können nicht verschlüsselt gespeichert werden.");
  }
  if (/^(COST_|VAT_)/.test(d.key) && d.value && !(Number(d.value) >= 0 && Number(d.value) <= 10000)) throw new HttpError(400, "Bitte eine Zahl eingeben (z. B. 1.5).");
  const field = PROVIDERS.flatMap((p) => p.fields).find((f) => f.key === d.key);
  if (d.value && field?.type === "url" && !/^https:\/\/[^\s]+$/i.test(d.value.trim())) throw new HttpError(400, "Bitte eine vollständige https-Adresse eingeben.");
  if (d.value && field?.type === "select" && field.options?.length && !field.options.some((o) => o.value === d.value)) throw new HttpError(400, "Ungültige Auswahl.");
  if (d.key === "SMTP_PORT" && d.value && !/^\d{2,5}$/.test(d.value.trim())) throw new HttpError(400, "Port muss eine Zahl sein.");
  await saveSetting(d.key, d.value, auth.user.id);
  await audit({ userId: auth.user.id, action: d.value ? "platform.setting.update" : "platform.setting.delete", target: d.key });
  return NextResponse.json({ ok: true });
});
