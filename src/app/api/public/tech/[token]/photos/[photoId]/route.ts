import { prisma } from "@/lib/db";
import { api, notFound } from "@/lib/http";
import { clientIp, enforce } from "@/lib/rate-limit";
import { employeeForToken } from "@/lib/services/jobs";
import { imageResponse } from "@/lib/services/job-media";

export const dynamic = "force-dynamic";
type P = { token: string; photoId: string };

/** Foto eines eigenen Einsatzes anzeigen */
export const GET = api<P>(async (req, { params }) => {
  const { token, photoId } = await params;
  enforce(`tech:${await clientIp(req)}`, { limit: 240, windowMs: 60_000 });
  const e = await employeeForToken(token);
  const p = await prisma.jobPhoto.findFirst({ where: { id: photoId, tenantId: e.tenantId, report: { ticket: { assignedEmployeeId: e.id } } } });
  if (!p) throw notFound("Foto");
  return imageResponse(p.mime, p.data);
});
