import type { Customer, Employee } from "@prisma/client";
import { xmlEscape as h } from "../twiml";
import { formatGermanDateTime } from "../time";
import { CUSTOMER_TYPE_LABEL, type CustomerType } from "../constants";

type Ctx = {
  customer: Customer;
  employee: Pick<Employee, "name" | "directPhone"> | null;
  pestType: string;
  urgency: string;
  summary: string;
  appointment?: { start: Date; end: Date } | null;
  timeZone: string;
  ticketId: string;
};

const wrap = (inner: string) =>
  `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#18181b;line-height:1.5">${inner}` +
  `<p style="margin-top:24px;color:#71717a;font-size:12px">Storm GmbH · Schädlingsbekämpfung · https://storm.gmbh</p></div>`;

export function customerConfirmationEmail(c: Ctx) {
  const salutation = c.customer.name ? `Guten Tag ${h(c.customer.name)},` : "Guten Tag,";
  const when = c.appointment
    ? `<p>wir bestätigen Ihren Termin am <b>${h(formatGermanDateTime(c.appointment.start, c.timeZone))}</b>` +
      (c.employee ? ` mit unserem Techniker <b>${h(c.employee.name)}</b>` : "") + `.</p>`
    : `<p>vielen Dank für Ihren Anruf. Wir haben Ihr Anliegen aufgenommen und melden uns schnellstmöglich zur Terminabstimmung.</p>`;
  return {
    subject: c.appointment
      ? `Terminbestätigung Schädlingsbekämpfung – ${formatGermanDateTime(c.appointment.start, c.timeZone)}`
      : `Ihre Anfrage bei der Storm GmbH (${c.pestType})`,
    html: wrap(
      `<p>${salutation}</p>${when}` +
        `<p><b>Anliegen:</b> ${h(c.pestType)}<br/>` +
        (c.customer.address ? `<b>Einsatzort:</b> ${h(c.customer.address)}${c.customer.postalCode ? `, ${h(c.customer.postalCode)}` : ""}<br/>` : "") +
        `<b>Vorgangsnummer:</b> ${h(c.ticketId)}</p>` +
        `<p>Bitte halten Sie den Zugang zu den betroffenen Bereichen frei und behandeln Sie die Stellen bis zu unserem Eintreffen nicht selbst.</p>` +
        `<p>Mit freundlichen Grüßen<br/>Ihr Team der Storm GmbH</p>`,
    ),
  };
}

export function technicianBriefingEmail(c: Ctx) {
  const type = CUSTOMER_TYPE_LABEL[c.customer.customerType as CustomerType] ?? c.customer.customerType;
  return {
    subject: `[${c.urgency}] ${c.pestType} – ${c.customer.companyName ?? c.customer.name ?? c.customer.phone}${c.customer.postalCode ? ` (${c.customer.postalCode})` : ""}`,
    html: wrap(
      `<h2 style="margin:0 0 8px">Neuer Einsatz aus der KI-Telefonzentrale</h2>` +
        `<table cellpadding="4" style="border-collapse:collapse">` +
        [
          ["Dringlichkeit", c.urgency],
          ["Schädling", c.pestType],
          ["Kunde", [c.customer.name, c.customer.companyName].filter(Boolean).join(" / ") || "–"],
          ["Kundentyp", `${type} (${c.customer.status === "NEW" ? "Neukunde" : "Bestandskunde"})`],
          ["Telefon", c.customer.phone],
          ["E-Mail", c.customer.email ?? "–"],
          ["Adresse", [c.customer.address, c.customer.postalCode].filter(Boolean).join(", ") || "–"],
          ["Termin", c.appointment ? formatGermanDateTime(c.appointment.start, c.timeZone) : "Rückruf erforderlich"],
          ["Ticket", c.ticketId],
        ]
          .map(([k, v]) => `<tr><td style="color:#71717a">${h(k)}</td><td><b>${h(String(v))}</b></td></tr>`)
          .join("") +
        `</table><h3>Zusammenfassung</h3><p>${h(c.summary)}</p>`,
    ),
  };
}

export function eventBody(c: Ctx) {
  return technicianBriefingEmail(c).html;
}
