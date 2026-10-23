/** Minimaler iCalendar-Termin (RFC 5545) – funktioniert mit Outlook, Google, Apple. */
const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);

export function buildIcs(e: { uid: string; start: Date; end: Date; summary: string; description: string; location?: string; organizerEmail?: string }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KI-Telefonzentrale//DE",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.summary)}`,
    `DESCRIPTION:${esc(e.description)}`,
    e.location ? `LOCATION:${esc(e.location)}` : null,
    e.organizerEmail ? `ORGANIZER:mailto:${e.organizerEmail}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
