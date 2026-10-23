import { NextResponse } from "next/server";
import { logger } from "../logger";
import { verifyVoiceRequest } from "../security";
import { formatToolResponse, normalizeToolRequest } from "./payload";
import { runTool } from "./tools";

export async function handleToolRequest(req: Request, toolNameFromPath?: string) {
  const raw = await req.text();
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

  const normalized = normalizeToolRequest(body, toolNameFromPath);
  const results = await Promise.all(
    normalized.calls.map(async (c) => ({
      id: c.id,
      result: await runTool(c.name || toolNameFromPath || "", c.args, { callerNumber: normalized.callerNumber }),
    })),
  );
  return NextResponse.json(formatToolResponse(normalized, results));
}
