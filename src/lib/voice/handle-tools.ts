import { NextResponse } from "next/server";
import { logger } from "../logger";
import { verifyVoiceRequest } from "../security";
import { formatToolResponse, normalizeToolRequest } from "./payload";
import { resolveVoiceContext } from "./context";
import { runTool } from "./tools";
import { clientIp, hit, LIMITS } from "../rate-limit";

export async function handleToolRequest(req: Request, toolNameFromPath?: string) {
  const wait = hit(`webhook:ip:${await clientIp(req)}`, LIMITS.webhookPerIp);
  if (wait) return NextResponse.json({ error: "Too Many Requests" }, { status: 429, headers: { "Retry-After": String(wait) } });
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyVoiceRequest(req, raw)) {
    logger.warn("voice.tools_unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const n = normalizeToolRequest(body, toolNameFromPath);
  const ctx = await resolveVoiceContext(n.callId, n.calledNumber, n.callerNumber);
  if (!ctx) {
    logger.warn("voice.tools_unknown_tenant", { callId: n.callId });
    const err = { error: "Anruf keinem Kunden zugeordnet. Bitte Anliegen notieren und Rückruf anbieten." };
    return NextResponse.json(formatToolResponse(n, n.calls.map((c) => ({ id: c.id, result: err }))));
  }
  const results = await Promise.all(n.calls.map(async (c) => ({ id: c.id, result: await runTool(c.name || toolNameFromPath || "", c.args, ctx) })));
  return NextResponse.json(formatToolResponse(n, results));
}
