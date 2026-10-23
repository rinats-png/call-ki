import { NextResponse } from "next/server";
import { z } from "zod";
import { CUSTOMER_TYPES, URGENCIES } from "@/lib/constants";
import { processServiceRequest } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(5),
  name: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  pestType: z.string().optional(),
  description: z.string().min(3),
  urgency: z.enum(URGENCIES).optional(),
  appointmentStart: z.string().datetime({ offset: true }).optional(),
  transcript: z.string().optional(),
});

/** Manuelle Erfassung / Anrufsimulation aus dem Hub – nutzt exakt denselben Workflow wie die Sprach-KI. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { phone, name, companyName, email, address, postalCode, customerType, ...rest } = parsed.data;
  try {
    const result = await processServiceRequest({
      customer: { phone, name, companyName, email, address, postalCode, customerType },
      ...rest,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
