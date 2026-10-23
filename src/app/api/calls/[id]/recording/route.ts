import { prisma } from "@/lib/db";
import { api, notFound, HttpError } from "@/lib/http";
import { requireTenant } from "@/lib/auth/session";
import { fetchRecording, recordingUrlAllowed } from "@/lib/voice/providers";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Liefert die Aufnahme eines Anrufs nur nach Berechtigungsprüfung aus (Regel 2.8):
 * Die Anbieter-URL verlässt nie den Server, das Abspielen wird protokolliert.
 */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const auth = await requireTenant();
  const { id } = await params;
  const call = await prisma.call.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true, recordingUrl: true } });
  if (!call?.recordingUrl) throw notFound("Aufnahme");
  if (!recordingUrlAllowed(call.recordingUrl)) throw new HttpError(502, "Aufnahmequelle nicht erlaubt");
  const upstream = await fetchRecording(call.recordingUrl).catch(() => null);
  if (!upstream?.ok || !upstream.body) throw new HttpError(502, "Aufnahme ist beim Anbieter nicht (mehr) verfügbar");
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: "call.recording_played", target: call.id });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
});
