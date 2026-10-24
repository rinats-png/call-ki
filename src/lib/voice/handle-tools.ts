import { NextResponse } from "next/server";
import { ensurePlatformConfig } from "../platform/config";
import { logger } from "../logger";
import { verifyVoiceRequest, voiceAuthAllows, type VoiceAuth } from "../security";
import { formatToolResponse, normalizeToolRequest } from "./payload";
import { resolveVoiceContext } from "./context";
import { runTool } from "./tools";
import { clientIp, hit, LIMITS } from "../rate-limit";

export async function handleToolRequest(req: Request, toolNameFromPath?: string) {
  await ensurePlatformConfig();
  const wait = hit(`webhook:ip:${await clientIp(req)}`, LIMITS.webhookPerIp);
  if (wait) return NextResponse.json({ error: "Too Many Requests" }, { status: 429, headers: { "Retry-After": String(wait) } });
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const auth = verifyVoiceRequest(req, raw);
  if (!auth) {
    logger.warn("voice.tools_unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await processToolBody(body, auth, toolNameFromPath);
  if (res === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(res);
}

/**
 * Führt die Funktionsaufrufe einer (bereits authentifizierten) Anfrage aus.
 * null = Format passt nicht zum Absender (z. B. ElevenLabs-Geheimnis mit Retell-Body).
 */
export async function processToolBody(body: unknown, auth: VoiceAuth, toolNameFromPath?: string) {
  const n = normalizeToolRequest(body, toolNameFromPath);
  if (!voiceAuthAllows(auth, n.provider)) {
    logger.warn("voice.tools_provider_mismatch", { auth, provider: n.provider });
    return null;
  }
  // Nur laufende Anrufe. Bei ElevenLabs/SIP stehen die Kennungen neben den KI-Argumenten –
  // dort zählt ausschließlich eine Anrufzeile, die wir selbst angelegt haben.
  const ctx = await resolveVoiceContext(n.callId, n.calledNumber, n.callerNumber, { twilioCallSid: n.twilioCallSid, callRef: n.callRef }, { activeOnly: true, requireCall: n.provider === "generic" });
  if (!ctx) {
    logger.warn("voice.tools_unknown_tenant", { callId: n.callId });
    const err = { error: "Anruf keinem Kunden zugeordnet. Bitte Anliegen notieren und Rückruf anbieten." };
    return formatToolResponse(n, n.calls.map((c) => ({ id: c.id, name: c.name, result: err })));
  }
  const results = await Promise.all(n.calls.map(async (c) => ({ id: c.id, name: c.name, result: await runTool(c.name || toolNameFromPath || "", c.args, ctx) })));
  return formatToolResponse(n, results);
}
