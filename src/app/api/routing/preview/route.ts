import { NextResponse } from "next/server";
import { URGENCIES, type Urgency } from "@/lib/constants";
import { assessUrgency } from "@/lib/urgency";
import { routeRequest } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

/** Live-Vorschau des Smart Routings für den Routing-Simulator im Hub. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const raw = u.get("urgency")?.toUpperCase();
  const aiUrgency = raw && (URGENCIES as readonly string[]).includes(raw) ? (raw as Urgency) : null;
  const customerType = u.get("customerType") ?? "PRIVATE";
  const pestType = u.get("pestType") ?? "";
  const urgency = assessUrgency({ pestType, description: u.get("description"), customerType, aiUrgency });
  const routing = await routeRequest({ postalCode: u.get("postalCode"), urgency, customerType, pestType });
  return NextResponse.json({ urgency, ...routing });
}
