import { NextResponse, type NextRequest } from "next/server";

/**
 * Erste Schutzschicht (Edge): leitet Nutzer ohne Sitzungs-Cookie zum Login und
 * blockt Cross-Site-Schreibzugriffe (CSRF). Die eigentliche Prüfung von Sitzung,
 * Rolle und Mandant erfolgt serverseitig in jeder Route (src/lib/auth/session.ts).
 */
const SESSION_COOKIE = "ck_session";
const PUBLIC_PAGES = ["/login", "/setup", "/forgot", "/invite/", "/reset/", "/status"];
const PUBLIC_API = ["/api/auth/", "/api/twilio/", "/api/voice/", "/api/health", "/api/cron/"];
/** Webhooks werden von Twilio/Retell aufgerufen – eigene Signaturprüfung, kein CSRF-Check */
const WEBHOOK_API = ["/api/twilio/", "/api/voice/", "/api/cron/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && req.method !== "GET" && req.method !== "HEAD" && !WEBHOOK_API.some((p) => pathname.startsWith(p))) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Ungültige Herkunft" }, { status: 403 });
    }
  }

  if ((isApi ? PUBLIC_API : PUBLIC_PAGES).some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
