import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./http";
import { fromZoned, zonedParts } from "./time";

/**
 * Zusatzoptionen (Module). Ein Kunde sieht nur, was er gebucht hat – oder was sein Paket enthält
 * (Paket-Funktion mit demselben Schlüssel). Ohne Buchung bleibt die Oberfläche beim KI-Telefonassistenten.
 */
export const ADDONS = [
  {
    key: "invoicing",
    name: "Angebote & Rechnungen",
    tagline: "Angebote, Rechnungen und Mahnungen direkt aus dem Vorgang",
    includes: ["Angebote, Rechnungen, Gutschriften mit fortlaufender Nummer", "Überweisungs-QR-Code (GiroCode) auf jeder Rechnung", "Zahlungserinnerung und Mahnung, auch automatisch", "Zahlungsabgleich per Kontoauszug"],
    defaultPriceCents: 1900,
  },
  {
    key: "field_app",
    name: "Techniker-App",
    tagline: "Einsätze, Fotos und Kundenunterschrift auf dem Handy",
    includes: ["Tagesliste je Mitarbeiter, ohne eigenes Konto", "Befund, Material, Fotos, Unterschrift", "Einsatzbericht im Vorgang", "Rechnungsentwurf beim Abschluss (mit „Angebote & Rechnungen“)"],
    defaultPriceCents: 2900,
  },
  {
    key: "customer_contact",
    name: "Kundenkontakt plus",
    tagline: "Weniger Leerfahrten, mehr Bewertungen",
    includes: ["„Passt es noch?“ in der Erinnerungs-SMS (Antwort JA/NEIN)", "„Techniker ist unterwegs“ (mit Techniker-App)", "Bitte um Bewertung nach dem Einsatz"],
    defaultPriceCents: 900,
  },
] as const;

export type AddonKey = (typeof ADDONS)[number]["key"];
export const ADDON_KEYS = ADDONS.map((a) => a.key) as AddonKey[];
export const addonName = (k: string) => ADDONS.find((a) => a.key === k)?.name ?? k;
export const isAddonKey = (k: string): k is AddonKey => (ADDON_KEYS as string[]).includes(k);

type Db = Prisma.TransactionClient | typeof prisma;

/** Aktive Buchungen zum Zeitpunkt `at` (endsAt in der Zukunft = gekündigt, aber noch nutzbar). */
const activeWhere = (tenantId: string, at: Date) => ({ tenantId, startedAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gt: at } }] });

/** Aktive Module eines Kunden: gebuchte Zusatzoptionen plus im Paket enthaltene. */
export async function activeModules(tenantId: string, at = new Date(), db: Db = prisma): Promise<AddonKey[]> {
  const [booked, t] = await Promise.all([
    db.tenantAddon.findMany({ where: activeWhere(tenantId, at), select: { key: true } }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { planRef: { select: { features: true } } } }),
  ]);
  const set = new Set<string>([...booked.map((b) => b.key), ...(t?.planRef?.features ?? [])]);
  return ADDON_KEYS.filter((k) => set.has(k));
}

export async function hasModule(tenantId: string, key: AddonKey, at = new Date()): Promise<boolean> {
  return (await activeModules(tenantId, at)).includes(key);
}

/** Serverseitige Sperre: Funktion nur mit gebuchter Zusatzoption. */
export async function requireModule(tenantId: string, key: AddonKey): Promise<void> {
  if (!(await hasModule(tenantId, key))) throw new HttpError(403, `Die Zusatzoption „${addonName(key)}“ ist nicht gebucht. Sie können sie unter Tarif hinzubuchen.`, { code: "ADDON_REQUIRED", addon: key });
}

/** Aktuelle Preise (Standard aus dem Code, vom Betreiber unter Preise & Pakete änderbar). */
export async function addonPrices(): Promise<Record<AddonKey, { priceCents: number; active: boolean }>> {
  const rows = await prisma.addonPrice.findMany();
  return Object.fromEntries(ADDONS.map((a) => {
    const r = rows.find((x) => x.key === a.key);
    return [a.key, { priceCents: r?.monthlyPriceCents ?? a.defaultPriceCents, active: r?.active ?? true }];
  })) as Record<AddonKey, { priceCents: number; active: boolean }>;
}

/** Ende des laufenden Monats in der Zeitzone des Kunden (Kündigung wirkt zum Monatsende). */
export function endOfMonth(at: Date, tz: string): Date {
  const p = zonedParts(at, tz);
  return p.month === 12 ? fromZoned(p.year + 1, 1, 1, 0, 0, tz) : fromZoned(p.year, p.month + 1, 1, 0, 0, tz);
}

/** Hinzubuchen: sofort aktiv. Eine zum Monatsende gekündigte Buchung wird einfach fortgesetzt. */
export async function bookAddon(tenantId: string, key: AddonKey, opts: { userId?: string | null; priceCents?: number } = {}, now = new Date()) {
  const prices = await addonPrices();
  if (opts.priceCents === undefined && !prices[key].active) throw new HttpError(409, "Diese Zusatzoption ist derzeit nicht buchbar.");
  const current = await prisma.tenantAddon.findFirst({ where: { ...activeWhere(tenantId, now), key } });
  if (current) {
    if (!current.endsAt) throw new HttpError(409, "Bereits gebucht.");
    return prisma.tenantAddon.update({ where: { id: current.id }, data: { endsAt: null } });
  }
  return prisma.tenantAddon.create({ data: { tenantId, key, priceCents: opts.priceCents ?? prices[key].priceCents, startedAt: now, bookedById: opts.userId ?? null } });
}

/** Kündigen zum Monatsende (immediate = sofort, nur Betreiber). */
export async function cancelAddon(tenantId: string, key: AddonKey, opts: { immediate?: boolean } = {}, now = new Date()) {
  const current = await prisma.tenantAddon.findFirst({ where: { ...activeWhere(tenantId, now), key } });
  if (!current) throw new HttpError(409, "Nicht gebucht.");
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } });
  return prisma.tenantAddon.update({ where: { id: current.id }, data: { endsAt: opts.immediate ? now : endOfMonth(now, t.timezone) } });
}

/** Für die Monatsabrechnung: jede Buchung, die im Monat aktiv war, zählt einmal mit ihrem Preis. */
export async function addonsForPeriod(tenantId: string, start: Date, end: Date) {
  const rows = await prisma.tenantAddon.findMany({ where: { tenantId, startedAt: { lt: end }, OR: [{ endsAt: null }, { endsAt: { gt: start } }] }, orderBy: { startedAt: "asc" } });
  const byKey = new Map<string, { key: string; name: string; priceCents: number }>();
  for (const r of rows) byKey.set(r.key, { key: r.key, name: addonName(r.key), priceCents: Math.max(byKey.get(r.key)?.priceCents ?? 0, r.priceCents) });
  return [...byKey.values()];
}
