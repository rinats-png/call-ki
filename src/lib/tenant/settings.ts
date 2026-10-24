import { z } from "zod";
import { getTemplate, type IndustryTemplate, type UrgencyRules } from "./templates";

/** Uhrzeit "HH:MM" */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM");
const keywordList = z.array(z.string().trim().min(2).max(60)).max(100);

/**
 * Mandanten-Einstellungen (gespeichert als JSON in Tenant.settings).
 * Fehlende Werte werden mit Defaults bzw. Branchenvorlage aufgefüllt – neue
 * Einstellungen können so jederzeit ergänzt werden, ohne Migration.
 */
export const tenantSettingsSchema = z.object({
  assistantName: z.string().trim().min(1).max(40).default("Lena"),
  /** Eigene Begrüßung; leer = Standard */
  greeting: z.string().trim().max(400).default(""),
  companyDescription: z.string().trim().max(2000).default(""),
  serviceArea: z.string().trim().max(500).default(""),
  /** Häufige Fragen & Antworten, Freitext für die KI */
  faq: z.string().trim().max(8000).default(""),
  pricingPolicy: z.string().trim().max(1000).default("Die Kosten bespricht unser Team vor Ort transparent mit Ihnen."),
  /** Zusätzliche Anweisungen an die KI */
  extraInstructions: z.string().trim().max(4000).default(""),
  /** Hinweis auf Gesprächsaufzeichnung in der Begrüßung */
  announceRecording: z.boolean().default(true),
  /** Wird aufgezeichnet: nur ansagen (announce) oder ausdrücklich fragen (ask, Variante C – bei „Nein“ wird die Aufnahme gelöscht) */
  recordingConsent: z.enum(["announce", "ask"]).default("announce"),

  /** Eigene Kategorien; leer = Branchenvorlage */
  categories: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  /** Zusätzliche Stichwörter (ergänzen die Branchenvorlage) */
  urgencyKeywords: z.object({ critical: keywordList.default([]), high: keywordList.default([]), low: keywordList.default([]) }).prefault({}),

  businessHours: z
    .object({
      days: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]), // ISO: 1 = Mo … 7 = So
      start: hhmm.default("08:00"),
      end: hhmm.default("18:00"),
    })
    .prefault({}),
  appointments: z
    .object({
      /** 0 = Dauer aus Branchenvorlage */
      durationMin: z.number().int().min(0).max(480).default(0),
      bufferMin: z.number().int().min(0).max(240).default(30), // Anfahrt / Puffer zwischen Terminen
      leadMin: z.number().int().min(0).max(2880).default(120), // frühester Termin ab jetzt
      daysAhead: z.number().int().min(1).max(60).default(10),
      slotsOffered: z.number().int().min(1).max(5).default(3),
    })
    .prefault({}),
  notifications: z
    .object({
      customerConfirmation: z.enum(["off", "email", "sms", "both"]).default("email"),
      technicianAlert: z.enum(["off", "email", "sms", "both"]).default("email"),
      emergencyAlert: z.enum(["email", "sms", "both"]).default("both"),
      /** Kopie aller Vorgänge an das Büro */
      backofficeEmail: z.string().email().or(z.literal("")).default(""),
      /** Bei verbundenem Microsoft 365: Kundenbestätigung nur als Entwurf ablegen statt senden */
      microsoftDraftsOnly: z.boolean().default(true),
      /** Terminerinnerung an den Kunden vor dem Termin */
      reminder: z.enum(["off", "email", "sms", "both"]).default("off"),
      reminderHoursBefore: z.number().int().min(2).max(72).default(24),
      /** Rufnummer in der Erinnerung zum Verschieben/Absagen (die bekannte Firmennummer) */
      contactPhone: z.string().trim().max(30).default(""),
    })
    .prefault({}),
  emergency: z
    .object({
      enabled: z.boolean().default(true),
      /** Fallback-Nummer für Live-Durchstellung, wenn der Notdienst-Techniker keine Direktwahl hat */
      transferNumber: z.string().trim().max(30).default(""),
    })
    .prefault({}),
  /** Datenschutzinformation des Kunden für Anrufer (Art. 13 DSGVO), wird von der KI genannt */
  privacyUrl: z.string().trim().max(300).url().or(z.literal("")).default(""),
  /** Löschfrist für Transkripte/Aufnahmen in Tagen (DSGVO) */
  retentionDays: z.number().int().min(7).max(3650).default(365),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

export function parseSettings(raw: unknown): TenantSettings {
  const r = tenantSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : tenantSettingsSchema.parse({});
}

/** Effektive Konfiguration = Branchenvorlage + Mandanten-Einstellungen */
export type TenantConfig = {
  settings: TenantSettings;
  template: IndustryTemplate;
  categories: string[];
  urgencyRules: UrgencyRules;
  durationMin: number;
};

export function resolveConfig(tenant: { industry: string; settings: unknown }): TenantConfig {
  const settings = parseSettings(tenant.settings);
  const template = getTemplate(tenant.industry);
  const t = template.urgency;
  const k = settings.urgencyKeywords;
  return {
    settings,
    template,
    categories: settings.categories.length ? settings.categories : template.categories,
    urgencyRules: {
      ...t,
      critical: [...t.critical, ...k.critical],
      high: [...t.high, ...k.high],
      low: [...t.low, ...k.low],
    },
    durationMin: settings.appointments.durationMin || template.defaultDurationMin,
  };
}
