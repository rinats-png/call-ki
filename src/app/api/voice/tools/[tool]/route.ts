import { handleToolRequest } from "@/lib/voice/handle-tools";

export const dynamic = "force-dynamic";

/** Ein Endpunkt pro Funktion, z. B. /api/voice/tools/book_appointment (Retell Custom Function URL). */
export async function POST(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  return handleToolRequest(req, tool);
}
