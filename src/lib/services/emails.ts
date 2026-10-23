import type { Customer, Employee, Tenant } from "@prisma/client";
import { xmlEscape as h } from "../twiml";
import { formatGermanDateTime } from "../time";
import { emailLayout } from "../notify";
import type { TenantConfig } from "../tenant/settings";
import type { CustomerType } from "../constants";

export type MailCtx = {
  tenant: Pick<Tenant, "name" | "timezone">;
  cfg: TenantConfig;
  customer: Customer;
  employee: Pick<Employee, "name" | "directPhone"> | null;
  category: string;
  urgency: string;
  summary: string;
  appointment?: { start: Date; end: Date } | null;
  ticketId: string;
};

const URG: Record<string, string> = { LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch", CRITICAL: "NOTFALL" };

export function customerConfirmationEmail(c: MailCtx) {
  const noun = c.cfg.template.jobNoun;
  const tz = c.tenant.timezone;
  const salutation = c.customer.name ? `Guten Tag ${h(c.customer.name)},` : "Guten Tag,";
  const when = c.appointment
    ? `<p>wir bestätigen Ihren ${h(noun)} am <b>${h(formatGermanDateTime(c.appointment.start, tz))}</b>${c.employee ? ` mit <b>${h(c.employee.name)}</b>` : ""}.</p>`
    : `<p>vielen Dank für Ihren Anruf. Wir haben Ihr Anliegen aufgenommen und melden uns schnellstmöglich zur Terminabstimmung.</p>`;
  return {
    subject: c.appointment ? `Terminbestätigung – ${formatGermanDateTime(c.appointment.start, tz)}` : `Ihre Anfrage bei ${c.tenant.name}`,
    html: emailLayout(
      `<p>${salutation}</p>${when}` +
        `<p><b>Anliegen:</b> ${h(c.category)}<br/>` +
        (c.customer.address ? `<b>Adresse:</b> ${h(c.customer.address)}${c.customer.postalCode ? `, ${h(c.customer.postalCode)}` : ""}<br/>` : "") +
        `<b>Vorgangsnummer:</b> ${h(c.ticketId.slice(-8).toUpperCase())}</p>` +
        c.cfg.template.safetyRules.filter((r) => /lassen|selbst/i.test(r)).map((r) => `<p>${h(r)}</p>`).join("") +
        `<p>Mit freundlichen Grüßen<br/>${h(c.tenant.name)}</p>`,
      `${h(c.tenant.name)} · Diese Nachricht wurde von unserer digitalen Telefonassistenz erstellt.`,
    ),
  };
}

export function technicianBriefingEmail(c: MailCtx) {
  const tz = c.tenant.timezone;
  const type = c.cfg.template.customerTypeLabels[c.customer.customerType as CustomerType] ?? c.customer.customerType;
  const rows: [string, string][] = [
    ["Dringlichkeit", URG[c.urgency] ?? c.urgency],
    ["Anliegen", c.category],
    ["Kunde", [c.customer.name, c.customer.companyName].filter(Boolean).join(" / ") || "–"],
    ["Kundentyp", `${type} (${c.customer.status === "NEW" ? "Neukunde" : "Bestandskunde"})`],
    ["Telefon", c.customer.phone],
    ["E-Mail", c.customer.email ?? "–"],
    ["Adresse", [c.customer.address, c.customer.postalCode].filter(Boolean).join(", ") || "–"],
    ["Termin", c.appointment ? formatGermanDateTime(c.appointment.start, tz) : "Rückruf erforderlich"],
    ["Vorgang", c.ticketId.slice(-8).toUpperCase()],
  ];
  return {
    subject: `[${URG[c.urgency] ?? c.urgency}] ${c.category} – ${c.customer.companyName ?? c.customer.name ?? c.customer.phone}${c.customer.postalCode ? ` (${c.customer.postalCode})` : ""}`,
    html: emailLayout(
      `<h2 style="margin:0 0 8px">Neuer ${h(c.cfg.template.jobNoun)} aus der KI-Telefonzentrale</h2>` +
        `<table cellpadding="4" style="border-collapse:collapse">` +
        rows.map(([k, v]) => `<tr><td style="color:#6b7484">${h(k)}</td><td><b>${h(v)}</b></td></tr>`).join("") +
        `</table><h3>Zusammenfassung</h3><p>${h(c.summary)}</p>`,
      h(c.tenant.name),
    ),
  };
}

export function technicianSms(c: MailCtx) {
  const when = c.appointment ? formatGermanDateTime(c.appointment.start, c.tenant.timezone) : "Rückruf";
  return `${c.urgency === "CRITICAL" ? "NOTFALL: " : ""}${c.category} · ${c.customer.name ?? c.customer.phone} · ${[c.customer.address, c.customer.postalCode].filter(Boolean).join(" ")} · ${when} · Tel ${c.customer.phone}`;
}

export function customerSms(c: MailCtx) {
  return c.appointment
    ? `${c.tenant.name}: Ihr Termin am ${formatGermanDateTime(c.appointment.start, c.tenant.timezone)} ist bestätigt. Vorgang ${c.ticketId.slice(-8).toUpperCase()}.`
    : `${c.tenant.name}: Ihre Anfrage ist eingegangen, wir melden uns zur Terminabstimmung.`;
}
