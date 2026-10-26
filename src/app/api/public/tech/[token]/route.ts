import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { clientIp, enforce } from "@/lib/rate-limit";
import { employeeForToken, jobsFor } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
type P = { token: string };

/** Techniker-App: eigene Einsätze über den Geräte-Link */
export const GET = api<P>(async (req, { params }) => {
  const { token } = await params;
  enforce(`tech:${await clientIp(req)}`, { limit: 120, windowMs: 60_000 });
  const e = await employeeForToken(token);
  const jobs = await jobsFor(e);
  return NextResponse.json({ employee: { name: e.name }, tenant: { name: e.tenant.name }, jobs }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
});
