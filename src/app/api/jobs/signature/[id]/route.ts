import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { imageResponse } from "@/lib/services/job-media";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Kundenunterschrift eines Einsatzberichts (id = Bericht) */
export const GET = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const r = await prisma.jobReport.findFirst({ where: { id, tenantId: auth.tenantId }, select: { signaturePng: true } });
  if (!r?.signaturePng) throw notFound("Unterschrift");
  return imageResponse("image/png", r.signaturePng);
});
