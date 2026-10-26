import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/http";
import { clientIp, enforce } from "@/lib/rate-limit";
import { addPhoto, employeeForToken, MAX_PHOTO_BYTES } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
type P = { token: string; ticketId: string };

/** Foto hochladen (Rohdaten, Content-Type image/jpeg|png|webp; der Browser verkleinert vorher) */
export const POST = api<P>(async (req, { params }) => {
  const { token, ticketId } = await params;
  enforce(`tech-photo:${await clientIp(req)}`, { limit: 40, windowMs: 60_000 });
  const e = await employeeForToken(token);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) throw new HttpError(413, "Foto zu groß.");
  const buf = Buffer.from(await req.arrayBuffer());
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  return NextResponse.json(await addPhoto(e, ticketId, mime, buf), { status: 201 });
});
