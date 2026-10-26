import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { clientIp, enforce } from "@/lib/rate-limit";
import { deletePhoto, employeeForToken } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
type P = { token: string; ticketId: string; photoId: string };

export const DELETE = api<P>(async (req, { params }) => {
  const { token, ticketId, photoId } = await params;
  enforce(`tech:${await clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  await deletePhoto(await employeeForToken(token), ticketId, photoId);
  return NextResponse.json({ ok: true });
});
