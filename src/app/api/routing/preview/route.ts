import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { loadTenant } from "@/lib/tenant";
import { URGENCIES, type Urgency } from "@/lib/constants";
import { assessUrgency } from "@/lib/urgency";
import { routeRequest } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

export const GET = api(async (req) => {
  const auth = await requireTenant();
  const { cfg } = await loadTenant(auth.tenantId);
  const u = new URL(req.url).searchParams;
  const raw = u.get("urgency")?.toUpperCase();
  const aiUrgency = raw && (URGENCIES as readonly string[]).includes(raw) ? (raw as Urgency) : null;
  const customerType = u.get("customerType") ?? "PRIVATE";
  const category = u.get("category") ?? "";
  const urgency = assessUrgency({ category, description: u.get("description"), customerType, aiUrgency, rules: cfg.urgencyRules });
  const routing = await routeRequest(auth.tenantId, cfg, { postalCode: u.get("postalCode"), urgency, customerType, category });
  return NextResponse.json({ urgency, ...routing, employee: routing.employee && { name: routing.employee.name, role: routing.employee.role, directPhone: routing.employee.directPhone } });
});
