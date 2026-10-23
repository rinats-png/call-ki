import { NextResponse } from "next/server";
import { ensurePlatformConfig, setting } from "@/lib/platform/config";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { verifyVoiceRequest } from "@/lib/security";
import { handleCallEvent } from "@/lib/services/calls";
import { findCustomerByPhone } from "@/lib/services/customers";
import { parseCallEvent } from "@/lib/voice/events";
import { processToolBody } from "@/lib/voice/handle-tools";
import { findCallRef } from "@/lib/voice/payload";
import { buildDynamicVariables, numberFromSipUser, resolveVoiceContext } from "@/lib/voice/context";
import { providerFor } from "@/lib/voice/handoff";
import { zeroRetention } from "@/lib/voice/retention-flags";
import { normalizePhone } from "@/lib/phone";
import { clientIp, hit, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/**
 * Vapi-Server-URL: ein Endpunkt für alle Nachrichten.
 *  - assistant-request → Assistent + Firmendaten des Kunden (variableValues), Antwort < 7,5 s
 *  - tool-calls        → Funktionen ausführen
 *  - end-of-call-report → Transkript, Zusammenfassung, Dauer speichern
 */
export async function POST(req: Request) {
  await ensurePlatformConfig();
  const wait = hit(`webhook:ip:${await clientIp(req)}`, LIMITS.webhookPerIp);
  if (wait) return NextResponse.json({ error: "Too Many Requests" }, { status: 429, headers: { "Retry-After": String(wait) } });
  const raw = await req.text();
  if (raw.length > 2 * 1024 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyVoiceRequest(req, raw)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Json;
  try {
    body = obj(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const msg = obj(body.message);
  try {
    switch (msg.type) {
      case "assistant-request":
        return NextResponse.json(await assistantRequest(msg));
      case "tool-calls":
        return NextResponse.json(await processToolBody(body));
      case "end-of-call-report": {
        const ev = parseCallEvent(body);
        const call = ev ? await handleCallEvent(ev) : null;
        return NextResponse.json({ ok: true, callId: call?.id ?? null });
      }
      default:
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    logger.error("vapi.message_failed", { type: String(msg.type), error: (err as Error).message });
    if (msg.type === "assistant-request") return NextResponse.json({ error: "Der Assistent ist gerade nicht erreichbar. Bitte rufen Sie später erneut an." });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function assistantRequest(msg: Json) {
  const call = obj(msg.call);
  const phone = obj(msg.phoneNumber ?? call.phoneNumber);
  const toNumber = normalizePhone(String(phone.number ?? "")) ?? numberFromSipUser(String(phone.sipUri ?? ""));
  const caller = normalizePhone(String(obj(msg.customer ?? call.customer).number ?? "")) ?? null;
  const ctx = await resolveVoiceContext(null, toNumber, caller, { callRef: findCallRef(call) });
  if (!ctx) {
    logger.warn("vapi.assistant_request_unknown", { to: toNumber });
    return { error: "Diese Rufnummer ist derzeit nicht vergeben." };
  }
  // Unsere Anrufzeile mit der Vapi-Call-ID verknüpfen (für Funktionen, Gesprächsende und Löschung)
  let rowId = ctx.callRowId;
  if (!rowId && toNumber) {
    const row = await prisma.call.findFirst({ where: { tenantId: ctx.tenant.id, toNumber, providerCallId: null, provider: "vapi", startedAt: { gte: new Date(Date.now() - 2 * 60_000) } }, orderBy: { startedAt: "desc" } });
    rowId = row?.id ?? null;
  }
  if (rowId && typeof call.id === "string") {
    await prisma.call.updateMany({ where: { id: rowId, providerCallId: null }, data: { providerCallId: call.id } }).catch(() => undefined);
  }
  const number = toNumber ? await prisma.phoneNumber.findUnique({ where: { e164: toNumber } }) : null;
  const choice = number ? providerFor(number, ctx.tenant) : { agentId: ctx.tenant.voiceAgentId };
  const recorded = ctx.cfg.settings.announceRecording || !zeroRetention("vapi");
  const customer = ctx.callerNumber ? await findCustomerByPhone(ctx.tenant.id, ctx.callerNumber) : null;
  return {
    assistantId: choice.agentId || setting("VAPI_ASSISTANT_ID"),
    assistantOverrides: { variableValues: buildDynamicVariables(ctx.tenant, ctx.cfg, { number: ctx.callerNumber ?? "anonymous", customer }, recorded) },
  };
}
