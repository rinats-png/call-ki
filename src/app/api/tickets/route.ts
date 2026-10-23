import { NextResponse } from "next/server";
import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { loadTenant } from "@/lib/tenant";
import { CUSTOMER_TYPES, URGENCIES } from "@/lib/constants";
import { processServiceRequest } from "@/lib/services/tickets";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(5),
  name: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  category: z.string().optional(),
  description: z.string().min(3),
  urgency: z.enum(URGENCIES).optional(),
  appointmentStart: z.string().datetime({ offset: true }).optional(),
  employeeId: z.string().optional(),
});

/** Manuelle Erfassung (Büro) – identischer Ablauf wie bei der Sprach-KI. */
export const POST = api(async (req) => {
  const auth = await requireTenant();
  const { tenant, cfg } = await loadTenant(auth.tenantId);
  const { phone, name, companyName, email, address, postalCode, customerType, ...rest } = schema.parse(await readJson(req));
  const result = await processServiceRequest(tenant, cfg, { customer: { phone, name, companyName, email, address, postalCode, customerType }, ...rest });
  await audit({ tenantId: tenant.id, userId: auth.user.id, action: "ticket.create_manual", target: result.ticket.id });
  return NextResponse.json(result, { status: 201 });
});
