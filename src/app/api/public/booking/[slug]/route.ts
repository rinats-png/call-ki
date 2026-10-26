import { NextResponse } from "next/server";
import { z } from "zod";
import { api, HttpError, readJson } from "@/lib/http";
import { clientIp, enforce, enforceShared } from "@/lib/rate-limit";
import { bookingInfo, bookingSlots, bookOnline } from "@/lib/services/booking";

export const dynamic = "force-dynamic";
type P = { slug: string };
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Öffentliche Buchungsseite: Leistungen und Texte */
export const GET = api<P>(async (req, { params }) => {
  const { slug } = await params;
  enforce(`booking:${await clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  return NextResponse.json(await bookingInfo(slug), { headers });
});

const slotsBody = z.object({ action: z.literal("slots"), serviceId: z.string().min(1).max(40), postalCode: z.string().trim().regex(/^\d{4,5}$/, "Bitte eine gültige PLZ angeben."), address: z.string().trim().max(200).optional() });
const bookBody = z.object({
  action: z.literal("book"), serviceId: z.string().min(1).max(40), start: z.string().datetime(),
  name: z.string().trim().min(2, "Bitte Ihren Namen angeben.").max(80), phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(120).optional().or(z.literal("")),
  address: z.string().trim().min(3, "Bitte die Adresse angeben.").max(200), postalCode: z.string().trim().regex(/^\d{4,5}$/),
  note: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { message: "Bitte den Hinweis zum Datenschutz bestätigen." }),
  /** Spamschutz: verstecktes Feld muss leer sein, Formular frühestens nach 3 Sekunden absenden */
  website: z.string().max(0).optional(), openedAt: z.number().int(),
});

export const POST = api<P>(async (req, { params }) => {
  const { slug } = await params;
  const ip = await clientIp(req);
  const raw = await readJson(req) as { action?: string };
  if (raw?.action === "slots") {
    enforce(`booking-slots:${ip}`, { limit: 40, windowMs: 60_000 });
    const d = slotsBody.parse(raw);
    return NextResponse.json(await bookingSlots(slug, d), { headers });
  }
  const d = bookBody.parse(raw);
  if (Date.now() - d.openedAt < 3000) throw new HttpError(400, "Bitte versuchen Sie es noch einmal.");
  await enforceShared(`booking-book:${ip}`, { limit: 5, windowMs: 3600_000 }, "Zu viele Buchungen von diesem Anschluss. Bitte rufen Sie uns an.");
  await enforceShared(`booking-phone:${slug}:${d.phone.replace(/\D/g, "")}`, { limit: 3, windowMs: 86400_000 }, "Mit dieser Telefonnummer wurden heute schon Termine gebucht. Bitte rufen Sie uns an.");
  return NextResponse.json(await bookOnline(slug, { ...d, email: d.email || null }), { headers });
});
