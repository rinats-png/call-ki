import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Nicht angemeldet");
export const forbidden = () => new HttpError(403, "Keine Berechtigung");
export const notFound = (what = "Eintrag") => new HttpError(404, `${what} nicht gefunden`);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);

import { ensurePlatformConfig } from "./platform/config";

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** Einheitliche Fehlerbehandlung für API-Routen. */
export function api<P = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      await ensurePlatformConfig();
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        const retry = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status, headers: retry ? { "Retry-After": String(retry) } : undefined });
      }
      if (err instanceof ZodError) return NextResponse.json({ error: "Ungültige Eingaben", details: err.flatten() }, { status: 400 });
      logger.error("api.unhandled", { path: new URL(req.url).pathname, error: (err as Error).message, stack: (err as Error).stack });
      return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
    }
  };
}

/** Maximale Größe von JSON-Anfragen (security/standardwerte.md §7) */
export const MAX_JSON_BYTES = 100 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, "Anfrage zu groß");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_JSON_BYTES) throw new HttpError(413, "Anfrage zu groß");
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Ungültiges JSON");
  }
}
