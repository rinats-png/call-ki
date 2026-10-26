import { NextResponse } from "next/server";
import { api } from "@/lib/http";

export const dynamic = "force-dynamic";
type P = { token: string };

/** Web-App-Manifest je Geräte-Link: „Zum Startbildschirm“ öffnet direkt die eigenen Einsätze. */
export const GET = api<P>(async (_req, { params }) => {
  const { token } = await params;
  const safe = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : "";
  return NextResponse.json(
    { name: "Eira Einsätze", short_name: "Einsätze", start_url: `/t/${safe}`, scope: `/t/${safe}`, display: "standalone", background_color: "#0b0f14", theme_color: "#0b0f14", lang: "de", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
});
