import { handleToolRequest } from "@/lib/voice/handle-tools";

export const dynamic = "force-dynamic";

/** Sammel-Endpunkt für Function Calls (Vapi Server URL / Retell Custom Functions). */
export async function POST(req: Request) {
  return handleToolRequest(req);
}
