import { NextResponse, type NextRequest } from "next/server";

/**
 * Schützt Dashboard & interne APIs per HTTP Basic Auth.
 * Webhooks (Twilio, Voice-AI) prüfen eigene Signaturen und bleiben offen.
 */
const PUBLIC_PREFIXES = ["/api/twilio/", "/api/voice/", "/api/health"];

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const password = process.env.DASHBOARD_PASSWORD;
  const user = process.env.DASHBOARD_USER ?? "admin";
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("DASHBOARD_PASSWORD ist nicht gesetzt.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (timingSafeEqualStr(u, user) && timingSafeEqualStr(rest.join(":"), password)) return NextResponse.next();
    } catch {
      /* ungültiges Base64 */
    }
  }
  return new NextResponse("Authentifizierung erforderlich", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Storm KI-Telefonzentrale", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
