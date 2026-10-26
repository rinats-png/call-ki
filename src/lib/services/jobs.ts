import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { randomToken, sha256 } from "../auth/crypto";
import { parseSettings } from "../tenant/settings";
import { createDraft, type BillLine } from "./bills";
import { logger } from "../logger";

export const JOB_STATUS = ["OPEN", "EN_ROUTE", "ON_SITE", "DONE"] as const;
export type JobStatus = (typeof JOB_STATUS)[number];
export const JOB_STATUS_LABEL: Record<JobStatus, string> = { OPEN: "Geplant", EN_ROUTE: "Unterwegs", ON_SITE: "Vor Ort", DONE: "Erledigt" };
export type Material = { description: string; quantity: number; unit: string; unitCents: number; serviceId?: string | null };

export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 1_500_000;
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Neuer Geräte-Link für einen Mitarbeiter; nur der Hash wird gespeichert, der alte Link wird ungültig. */
export async function issueAppToken(tenantId: string, employeeId: string): Promise<string> {
  if (!(await prisma.employee.count({ where: { id: employeeId, tenantId } }))) throw new HttpError(404, "Mitarbeiter nicht gefunden.");
  const token = randomToken(24);
  const hash = sha256(token);
  await prisma.$transaction([
    prisma.employeeAppToken.deleteMany({ where: { employeeId } }),
    prisma.employeeAppToken.create({ data: { hash, employeeId, tenantId } }),
  ]);
  return token;
}

export async function revokeAppToken(tenantId: string, employeeId: string) {
  await prisma.employeeAppToken.deleteMany({ where: { employeeId, tenantId } });
}

/** Mitarbeiter zum Geräte-Link (aktiv, Betrieb nicht gesperrt). */
export async function employeeForToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) throw new HttpError(404, "Link ungültig.");
  const t = await prisma.employeeAppToken.findUnique({ where: { hash: sha256(token) }, include: { employee: { include: { tenant: true } } } });
  const e = t?.employee;
  if (!e || !e.active || e.tenant.status === "PAUSED") throw new HttpError(404, "Link ungültig oder abgelaufen. Bitte im Büro einen neuen Link anfordern.");
  return e;
}

const reportSelect = { id: true, status: true, enRouteAt: true, arrivedAt: true, finishedAt: true, findings: true, workDone: true, materials: true, hoursWorked: true, signatureName: true, signedAt: true, billId: true, photos: { select: { id: true, createdAt: true }, orderBy: { createdAt: "asc" as const } } } satisfies Prisma.JobReportSelect;

/** Einsätze des Mitarbeiters: offene Termine (14 Tage zurück bis 7 Tage voraus) und kürzlich erledigte. */
export async function jobsFor(employee: { id: string; tenantId: string }, now = new Date()) {
  const from = new Date(now.getTime() - 14 * 86400_000);
  const to = new Date(now.getTime() + 7 * 86400_000);
  const rows = await prisma.callTicket.findMany({
    where: { tenantId: employee.tenantId, assignedEmployeeId: employee.id, appointmentStart: { gte: from, lte: to }, OR: [{ status: { not: "CLOSED" } }, { jobReport: { finishedAt: { gte: new Date(now.getTime() - 86400_000) } } }] },
    orderBy: { appointmentStart: "asc" },
    take: 100,
    select: { id: true, category: true, urgency: true, summary: true, notes: true, appointmentStart: true, appointmentEnd: true, status: true, service: { select: { name: true } }, customer: { select: { name: true, companyName: true, phone: true, address: true, postalCode: true } }, jobReport: { select: reportSelect } },
  });
  return rows;
}

async function ticketFor(employee: { id: string; tenantId: string }, ticketId: string) {
  const t = await prisma.callTicket.findFirst({ where: { id: ticketId, tenantId: employee.tenantId, assignedEmployeeId: employee.id }, include: { jobReport: true, service: true, customer: true } });
  if (!t) throw new HttpError(404, "Einsatz nicht gefunden oder nicht (mehr) Ihnen zugeteilt.");
  return t;
}

async function ensureReport(employee: { id: string; tenantId: string }, ticketId: string) {
  const t = await ticketFor(employee, ticketId);
  const report = t.jobReport ?? (await prisma.jobReport.upsert({ where: { ticketId }, create: { tenantId: employee.tenantId, ticketId, employeeId: employee.id }, update: {} }));
  return { ticket: t, report };
}

export type JobUpdate = { findings?: string; workDone?: string; materials?: Material[]; hoursWorked?: number };

export async function updateJob(employee: { id: string; tenantId: string }, ticketId: string, d: JobUpdate) {
  const { report } = await ensureReport(employee, ticketId);
  if (report.status === "DONE") throw new HttpError(409, "Einsatz ist abgeschlossen.");
  return prisma.jobReport.update({
    where: { id: report.id },
    data: {
      ...(d.findings !== undefined ? { findings: d.findings } : {}),
      ...(d.workDone !== undefined ? { workDone: d.workDone } : {}),
      ...(d.materials !== undefined ? { materials: d.materials } : {}),
      ...(d.hoursWorked !== undefined ? { hoursWorked: Math.round(d.hoursWorked * 4) / 4 } : {}),
      employeeId: employee.id,
    },
    select: reportSelect,
  });
}

/** Statuswechsel: unterwegs → vor Ort (Zeitstempel bleiben beim ersten Setzen). */
export async function setJobStatus(employee: { id: string; tenantId: string }, ticketId: string, status: "EN_ROUTE" | "ON_SITE", now = new Date()) {
  const { report } = await ensureReport(employee, ticketId);
  if (report.status === "DONE") throw new HttpError(409, "Einsatz ist abgeschlossen.");
  const r = await prisma.jobReport.update({
    where: { id: report.id },
    data: { status, employeeId: employee.id, ...(status === "EN_ROUTE" && !report.enRouteAt ? { enRouteAt: now } : {}), ...(status === "ON_SITE" && !report.arrivedAt ? { arrivedAt: now } : {}) },
    select: reportSelect,
  });
  return { report: r, firstTime: status === "EN_ROUTE" ? !report.enRouteAt : !report.arrivedAt };
}

/** Rechnungspositionen aus dem Einsatz: Leistung (mit Preis), Arbeitszeit, Material mit Preis. */
export function invoiceLines(o: { service: { id: string; name: string; priceCents: number; unit: string; taxRate: number } | null; hoursWorked: number; hourlyRateCents: number; materials: Material[]; serviceDate?: Date | null }): BillLine[] {
  const lines: BillLine[] = [];
  if (o.service && o.service.priceCents > 0) lines.push({ description: o.service.name, quantity: 1, unit: o.service.unit, unitCents: o.service.priceCents, taxRate: o.service.taxRate, serviceId: o.service.id });
  if (o.hoursWorked > 0 && o.hourlyRateCents > 0) lines.push({ description: "Arbeitszeit", quantity: o.hoursWorked, unit: "Stunde", unitCents: o.hourlyRateCents, taxRate: 19 });
  for (const m of o.materials) if (m.description.trim() && m.quantity > 0 && m.unitCents > 0) lines.push({ description: m.description, quantity: m.quantity, unit: m.unit || "Stück", unitCents: m.unitCents, taxRate: 19, serviceId: m.serviceId ?? null });
  return lines;
}

/** Abschluss: Unterschrift speichern, Vorgang schließen, optional Rechnungsentwurf. */
export async function finishJob(employee: { id: string; tenantId: string }, ticketId: string, d: { signatureName?: string | null; signaturePng?: Buffer | null }, now = new Date()) {
  const { ticket, report } = await ensureReport(employee, ticketId);
  if (report.status === "DONE") throw new HttpError(409, "Einsatz ist bereits abgeschlossen.");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: employee.tenantId } });
  const cfg = parseSettings(tenant.settings).jobs;
  const signed = !!(d.signaturePng && d.signatureName?.trim());
  if (cfg.requireSignature && !signed) throw new HttpError(400, "Bitte vom Kunden unterschreiben lassen.");
  if (!report.workDone.trim() && !report.findings.trim()) throw new HttpError(400, "Bitte kurz eintragen, was gemacht wurde.");
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.jobReport.update({
      where: { id: report.id },
      data: { status: "DONE", finishedAt: now, arrivedAt: report.arrivedAt ?? now, employeeId: employee.id, ...(signed ? { signatureName: d.signatureName!.trim().slice(0, 80), signaturePng: new Uint8Array(d.signaturePng!), signedAt: now } : {}) },
    });
    await tx.callTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } });
    return r;
  });
  let billId: string | null = null;
  if (cfg.autoInvoiceDraft) {
    const lines = invoiceLines({ service: ticket.service, hoursWorked: report.hoursWorked, hourlyRateCents: cfg.hourlyRateCents, materials: (report.materials as unknown as Material[]) ?? [] });
    if (lines.length) {
      try {
        const b = await createDraft(employee.tenantId, { kind: "INVOICE", customerId: ticket.customerId, ticketId: ticket.id, lines, serviceDate: report.arrivedAt ?? now, note: report.workDone.trim() ? `Ausgeführt: ${report.workDone.trim().slice(0, 1500)}` : null });
        billId = b.id;
        await prisma.jobReport.update({ where: { id: done.id }, data: { billId } });
      } catch (e) {
        logger.warn("job.invoice_draft_failed", { tenantId: employee.tenantId, ticketId, error: (e as Error).message });
      }
    }
  }
  return { reportId: done.id, billId };
}

/** Bericht als Text formulieren (ohne externe KI): aus Anliegen, Befund, Arbeiten, Material, Zeiten. */
export function reportText(o: { category: string | null; summary: string | null; findings: string; workDone: string; materials: Material[]; hoursWorked: number; arrivedAt: Date | null; finishedAt: Date | null; employeeName?: string | null }): string {
  const t = (d: Date | null) => (d ? d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }) : "–");
  const parts = [
    `Einsatzbericht${o.category ? ` – ${o.category}` : ""}`,
    o.summary ? `Anliegen: ${o.summary}` : null,
    `Vor Ort: ${t(o.arrivedAt)} bis ${t(o.finishedAt)}${o.hoursWorked ? ` (Arbeitszeit ${String(o.hoursWorked).replace(".", ",")} h)` : ""}${o.employeeName ? `, ${o.employeeName}` : ""}`,
    o.findings.trim() ? `Befund: ${o.findings.trim()}` : null,
    o.workDone.trim() ? `Ausgeführte Arbeiten: ${o.workDone.trim()}` : null,
    o.materials.length ? `Material: ${o.materials.map((m) => `${String(m.quantity).replace(".", ",")} ${m.unit} ${m.description}`).join("; ")}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

export async function addPhoto(employee: { id: string; tenantId: string }, ticketId: string, mime: string, data: Buffer) {
  if (!PHOTO_MIME.includes(mime)) throw new HttpError(415, "Nur JPEG, PNG oder WebP.");
  if (data.length > MAX_PHOTO_BYTES) throw new HttpError(413, "Foto zu groß.");
  if (!looksLikeImage(mime, data)) throw new HttpError(415, "Datei ist kein Bild.");
  const { report } = await ensureReport(employee, ticketId);
  if (report.status === "DONE") throw new HttpError(409, "Einsatz ist abgeschlossen.");
  if ((await prisma.jobPhoto.count({ where: { reportId: report.id } })) >= MAX_PHOTOS) throw new HttpError(409, `Höchstens ${MAX_PHOTOS} Fotos je Einsatz.`);
  return prisma.jobPhoto.create({ data: { tenantId: employee.tenantId, reportId: report.id, mime, data: new Uint8Array(data), sizeBytes: data.length }, select: { id: true, createdAt: true } });
}

export async function deletePhoto(employee: { id: string; tenantId: string }, ticketId: string, photoId: string) {
  const { report } = await ensureReport(employee, ticketId);
  if (report.status === "DONE") throw new HttpError(409, "Einsatz ist abgeschlossen.");
  const r = await prisma.jobPhoto.deleteMany({ where: { id: photoId, reportId: report.id } });
  if (!r.count) throw new HttpError(404, "Foto nicht gefunden.");
}

/** Magic Bytes prüfen, damit nur echte Bilder gespeichert und ausgeliefert werden. */
export function looksLikeImage(mime: string, b: Buffer): boolean {
  if (mime === "image/jpeg") return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png") return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}

/** data:image/png;base64,… → Buffer (nur PNG, max. 200 KB) */
export function signatureFromDataUrl(s: string | null | undefined): Buffer | null {
  if (!s) return null;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) throw new HttpError(400, "Unterschrift ungültig.");
  const b = Buffer.from(m[1], "base64");
  if (b.length > 200_000 || !looksLikeImage("image/png", b)) throw new HttpError(400, "Unterschrift ungültig.");
  return b;
}
