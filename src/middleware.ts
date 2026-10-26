import { NextResponse, type NextRequest } from "next/server";

/**
 * Erste Schutzschicht (Edge): leitet Nutzer ohne Sitzungs-Cookie zum Login und
 * blockt Cross-Site-Schreibzugriffe (CSRF). Die eigentliche Prüfung von Sitzung,
 * Rolle und Mandant erfolgt serverseitig in jeder Route (src/lib/auth/session.ts).
 */
const SESSION_COOKIE = "ck_session";
const PUBLIC_PAGES = ["/login", "/setup", "/forgot", "/invite/", "/reset/", "/status", "/b/", "/t/", "/buchen/"];
const PUBLIC_API = ["/api/auth/", "/api/twilio/", "/api/voice/", "/api/health", "/api/cron/", "/api/public/"];
/** Webhooks werden von Twilio/Retell aufgerufen – eigene Signaturprüfung, kein CSRF-Check */
const WEBHOOK_API = ["/api/twilio/", "/api/voice/", "/api/cron/"];

/**
 * CSP mit Nonce je Anfrage: Skripte nur mit passender Nonce ('strict-dynamic' lässt von dort
 * nachgeladene Next.js-Chunks zu) – kein 'unsafe-inline' für Skripte. Next.js liest die Nonce
 * aus dem Request-Header und setzt sie an seine eigenen Inline-Skripte.
 */
export function cspHeader(nonce: string, dev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // style-Attribute (Diagramme, Fortschrittsbalken)
    "img-src 'self' data: https:",
    "media-src 'self' blob: https:", // blob: = Aufnahme, die der Wellenform-Player geladen hat
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  return route(req);
}

function withCsp(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = cspHeader(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

function route(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && req.method !== "GET" && req.method !== "HEAD" && !WEBHOOK_API.some((p) => pathname.startsWith(p))) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Ungültige Herkunft" }, { status: 403 });
    }
  }

  if ((isApi ? PUBLIC_API : PUBLIC_PAGES).some((p) => pathname.startsWith(p))) return isApi ? NextResponse.next() : withCsp(req);
  if (req.cookies.has(SESSION_COOKIE)) return isApi ? NextResponse.next() : withCsp(req);

  if (isApi) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
