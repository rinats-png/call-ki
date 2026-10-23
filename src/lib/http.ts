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

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** Einheitliche Fehlerbehandlung für API-Routen. */
export function api<P = Record<string, string>>(fn: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: "Ungültige Eingaben", details: err.flatten() }, { status: 400 });
      logger.error("api.unhandled", { path: new URL(req.url).pathname, error: (err as Error).message, stack: (err as Error).stack });
      return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Ungültiges JSON");
  }
}
