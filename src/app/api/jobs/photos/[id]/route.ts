import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { imageResponse } from "@/lib/services/job-media";

export const dynamic = "force-dynamic";
type P = { id: string };

/** Einsatzfoto für das Büro */
export const GET = api<P>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const p = await prisma.jobPhoto.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!p) throw notFound("Foto");
  return imageResponse(p.mime, p.data);
});
