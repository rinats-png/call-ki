import type { Tenant } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { hasModule } from "../addons";
import { findAvailableSlots, isSlotFree } from "../calendar";
import { normalizePhone } from "../phone";
import { formatGermanDateTime } from "../time";
import { resolveConfig, type TenantConfig } from "../tenant/settings";
import { assessUrgency } from "../urgency";
import { activeServices, cfgForService } from "./catalog";
import { processServiceRequest, routeRequest } from "./tickets";
import { locate, travelEnabled } from "./travel";

/** Betrieb zur Buchungsseite – nur mit gebuchter Zusatzoption und eingeschalteter Seite. */
export async function bookingTenant(slug: string): Promise<{ tenant: Tenant; cfg: TenantConfig }> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new HttpError(404, "Diese Buchungsseite gibt es nicht.");
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.status !== "ACTIVE") throw new HttpError(404, "Diese Buchungsseite gibt es nicht.");
  const cfg = resolveConfig(tenant);
  if (!cfg.settings.bookingPage.enabled || !(await hasModule(tenant.id, "booking_page"))) throw new HttpError(404, "Online-Buchung ist für diesen Betrieb nicht aktiv.");
  return { tenant, cfg };
}

export async function bookableServices(tenantId: string, cfg: TenantConfig) {
  const all = await activeServices(tenantId);
  const allow = cfg.settings.bookingPage.serviceIds;
  return all.filter((s) => !allow.length || allow.includes(s.id));
}

/** Öffentliche Angaben der Seite (keine Mitarbeiterdaten). */
export async function bookingInfo(slug: string) {
  const { tenant, cfg } = await bookingTenant(slug);
  const b = cfg.settings.bookingPage;
  const services = await bookableServices(tenant.id, cfg);
  return {
    name: tenant.name, headline: b.headline || `Termin bei ${tenant.name} buchen`, intro: b.intro, requireEmail: b.requireEmail,
    phone: cfg.settings.notifications.contactPhone || null, privacyUrl: cfg.settings.privacyUrl || null,
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin || cfg.durationMin })),
  };
}

async function serviceOf(tenantId: string, cfg: TenantConfig, serviceId: string) {
  const s = (await bookableServices(tenantId, cfg)).find((x) => x.id === serviceId);
  if (!s) throw new HttpError(400, "Bitte eine Leistung wählen.");
  return s;
}

/** Freie Termine: gleiche Zuständigkeit, Fahrzeiten und Regeln wie am Telefon, nur mehr Auswahl. */
export async function bookingSlots(slug: string, input: { serviceId: string; postalCode: string; address?: string | null }) {
  const { tenant, cfg: base } = await bookingTenant(slug);
  const service = await serviceOf(tenant.id, base, input.serviceId);
  const cfg0 = cfgForService(base, service);
  const cfg = { ...cfg0, settings: { ...cfg0.settings, appointments: { ...cfg0.settings.appointments, slotsOffered: 8, leadMin: Math.max(cfg0.settings.appointments.leadMin, 60) } } };
  const target = (await travelEnabled(tenant.id, cfg)) ? await locate({ address: input.address, postalCode: input.postalCode }) : null;
  const routing = await routeRequest(tenant.id, cfg, { postalCode: input.postalCode, urgency: "MEDIUM", category: service.name, trade: service.trade || null, target });
  if (!routing.employee || routing.employee.role === "BACKOFFICE" || (!routing.areaMatch && input.postalCode)) {
    return { slots: [], message: "Für diese Adresse können wir online leider keinen Termin anbieten. Bitte rufen Sie uns an." };
  }
  const r = await findAvailableSlots(tenant, cfg, routing.employee, { target });
  return { slots: r.slots.map((s) => ({ start: s.start.toISOString(), label: formatGermanDateTime(s.start, tenant.timezone) })), message: r.slots.length ? null : "In den nächsten Tagen ist leider nichts frei. Bitte rufen Sie uns an." };
}

export type BookingInput = { serviceId: string; start: string; name: string; phone: string; email?: string | null; address: string; postalCode: string; note?: string | null };

/** Buchen: Slot wird beim Anlegen erneut geprüft; bestehende Kundendaten werden nicht überschrieben. */
export async function bookOnline(slug: string, d: BookingInput) {
  const { tenant, cfg } = await bookingTenant(slug);
  const service = await serviceOf(tenant.id, cfg, d.serviceId);
  const phone = normalizePhone(d.phone);
  if (!phone || phone.length < 8) throw new HttpError(400, "Bitte eine gültige Telefonnummer angeben.");
  if (cfg.settings.bookingPage.requireEmail && !d.email) throw new HttpError(400, "Bitte eine E-Mail-Adresse für die Bestätigung angeben.");
  const start = new Date(d.start);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 30 * 60_000) throw new HttpError(400, "Dieser Termin ist nicht mehr verfügbar.");
  const description = [`Online gebucht: ${service.name}.`, d.note?.trim()].filter(Boolean).join(" ").slice(0, 2000);
  // Notfälle nicht online einplanen, sondern telefonisch
  const urgency = assessUrgency({ category: service.name, description, customerType: "PRIVATE", aiUrgency: null, rules: cfg.urgencyRules });
  if (urgency === "CRITICAL") throw new HttpError(409, cfg.settings.notifications.contactPhone ? `Das klingt nach einem Notfall – bitte rufen Sie uns sofort an: ${cfg.settings.notifications.contactPhone}.` : "Das klingt nach einem Notfall – bitte rufen Sie uns sofort an.");
  // Erst prüfen, dann anlegen: kein halber Vorgang, wenn der Termin inzwischen weg ist
  const scfg = cfgForService(cfg, service);
  const target = (await travelEnabled(tenant.id, scfg)) ? await locate({ address: d.address, postalCode: d.postalCode }) : null;
  const routing = await routeRequest(tenant.id, scfg, { postalCode: d.postalCode, urgency, category: service.name, trade: service.trade || null, target });
  const employee = routing.employee ? await prisma.employee.findFirst({ where: { id: routing.employee.id, tenantId: tenant.id, active: true } }) : null;
  const taken = async () => ({ ok: false as const, slots: (await bookingSlots(slug, { serviceId: d.serviceId, postalCode: d.postalCode, address: d.address })).slots, message: "Dieser Termin wurde gerade vergeben. Bitte wählen Sie eine andere Zeit." });
  if (!employee || !(await isSlotFree(tenant.id, scfg, employee, { start, end: new Date(start.getTime() + scfg.durationMin * 60000) }))) return taken();
  const res = await processServiceRequest(tenant, cfg, {
    customer: { phone, name: d.name, email: d.email || null, address: d.address, postalCode: d.postalCode, onlyFillMissing: true },
    category: service.name, description, appointmentStart: start, employeeId: employee.id,
  });
  if (res.slotTaken || !res.appointment) return taken();
  return { ok: true as const, reference: res.ticket.id.slice(-8).toUpperCase(), label: formatGermanDateTime(res.appointment.start, tenant.timezone), emailConfirmation: !!d.email };
}
