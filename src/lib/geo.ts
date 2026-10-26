import crypto from "node:crypto";
import { prisma } from "./db";
import { setting } from "./platform/config";
import { logger } from "./logger";

/**
 * Geokodierung und Fahrzeiten. Anbieter: OpenRouteService (EU, API-Schlüssel) oder eigene
 * Nominatim-/OSRM-Server. Ohne Anbieter oder bei Ausfall: Schätzung aus Luftlinie (nie blockierend).
 */
export type LatLon = { lat: number; lon: number };
export type Leg = { minutes: number; km: number; estimated: boolean };

const TIMEOUT = 4000;
const norm = (a: string) => a.toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
const keyOf = (a: string) => crypto.createHash("sha256").update(norm(a)).digest("hex");

export function geoProvider(): "ors" | "osm" | null {
  const p = setting("MAPS_PROVIDER");
  if (p === "ors" && setting("ORS_API_KEY")) return "ors";
  if (p === "osm" && setting("NOMINATIM_URL")) return "osm";
  return null;
}

async function getJson(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": `${setting("PLATFORM_NAME") || "KI-Telefonzentrale"} (Terminplanung)`, Accept: "application/json", ...init?.headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function geocodeRemote(address: string, provider: "ors" | "osm"): Promise<LatLon | null> {
  if (provider === "ors") {
    const u = new URL("https://api.openrouteservice.org/geocode/search");
    u.searchParams.set("api_key", setting("ORS_API_KEY")!);
    u.searchParams.set("text", address);
    u.searchParams.set("boundary.country", "DE,AT,CH");
    u.searchParams.set("size", "1");
    const j = await getJson(u.toString());
    const c = j?.features?.[0]?.geometry?.coordinates;
    return Array.isArray(c) ? { lon: Number(c[0]), lat: Number(c[1]) } : null;
  }
  const u = new URL("/search", setting("NOMINATIM_URL")!);
  u.searchParams.set("q", address);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "de,at,ch");
  const j = await getJson(u.toString());
  return j?.[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
}

/** Adresse → Koordinaten (Cache 180 Tage, auch „nicht gefunden“). Gibt null zurück, wenn kein Anbieter oder unbekannt. */
export async function geocode(address: string | null | undefined): Promise<LatLon | null> {
  const a = (address ?? "").trim();
  if (a.length < 4) return null;
  const key = keyOf(a);
  const hit = await prisma.geoCache.findUnique({ where: { key } });
  if (hit && hit.createdAt.getTime() > Date.now() - 180 * 86400_000) return hit.lat != null && hit.lon != null ? { lat: hit.lat, lon: hit.lon } : null;
  const provider = geoProvider();
  if (!provider) return null;
  try {
    const p = await geocodeRemote(a, provider);
    // auf ~10 m runden: genug für Fahrzeiten, weniger genau als nötig wäre, um Hausnummern zu rekonstruieren
    const r = p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4 } : null;
    await prisma.geoCache.upsert({ where: { key }, create: { key, lat: r?.lat ?? null, lon: r?.lon ?? null, provider: r ? provider : "none" }, update: { lat: r?.lat ?? null, lon: r?.lon ?? null, provider: r ? provider : "none", createdAt: new Date() } });
    return r;
  } catch (e) {
    logger.warn("geo.geocode_failed", { provider, error: (e as Error).message });
    return null;
  }
}

/** Adresse eines Kunden für die Geokodierung */
export const customerAddress = (c: { address?: string | null; postalCode?: string | null }) => {
  const a = (c.address ?? "").trim(), p = (c.postalCode ?? "").trim();
  if (!a && !p) return null;
  return [a, p && !a.includes(p) ? p : null, "Deutschland"].filter(Boolean).join(", ");
};

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Schätzung ohne Routing: Straßenfaktor 1,3, im Schnitt 45 km/h, plus 5 Minuten für Parken und Wege. */
export function estimateLeg(a: LatLon, b: LatLon): Leg {
  const km = haversineKm(a, b) * 1.3;
  return { km: Math.round(km * 10) / 10, minutes: km < 0.2 ? 0 : Math.round((km / 45) * 60 + 5), estimated: true };
}

const legCache = new Map<string, { leg: Leg; at: number }>();
const legKey = (a: LatLon, b: LatLon) => `${a.lat.toFixed(3)},${a.lon.toFixed(3)}>${b.lat.toFixed(3)},${b.lon.toFixed(3)}`;

/** Fahrzeit und Strecke mit dem Auto (Anbieter, sonst Schätzung). Ergebnisse 24 h im Speicher. */
export async function travel(a: LatLon, b: LatLon): Promise<Leg> {
  const k = legKey(a, b);
  const c = legCache.get(k);
  if (c && c.at > Date.now() - 86400_000) return c.leg;
  let leg = estimateLeg(a, b);
  const provider = geoProvider();
  if (provider && leg.km > 0.2) {
    try {
      if (provider === "ors") {
        const j = await getJson("https://api.openrouteservice.org/v2/directions/driving-car", { method: "POST", headers: { Authorization: setting("ORS_API_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }) });
        const s = j?.routes?.[0]?.summary;
        if (s) leg = { minutes: Math.round(Number(s.duration) / 60) + 3, km: Math.round(Number(s.distance) / 100) / 10, estimated: false };
      } else if (setting("OSRM_URL")) {
        const j = await getJson(new URL(`/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, setting("OSRM_URL")!).toString());
        const r = j?.routes?.[0];
        if (r) leg = { minutes: Math.round(Number(r.duration) / 60) + 3, km: Math.round(Number(r.distance) / 100) / 10, estimated: false };
      }
    } catch (e) {
      logger.warn("geo.route_failed", { provider, error: (e as Error).message });
    }
  }
  legCache.set(k, { leg, at: Date.now() });
  if (legCache.size > 5000) legCache.delete(legCache.keys().next().value!);
  return leg;
}

/** Löschjob: Geocache nach 180 Tagen */
export async function purgeGeoCache(now = new Date()) {
  return (await prisma.geoCache.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * 86400_000) } } })).count;
}
