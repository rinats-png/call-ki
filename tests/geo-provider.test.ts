import { afterEach, describe, expect, it, vi } from "vitest";

/** Anbieter-Aufrufe mit nachgestellten Antworten (kein Netz nötig) */
describe("OpenRouteService", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.MAPS_PROVIDER; delete process.env.ORS_API_KEY; vi.resetModules(); });
  it("Fahrzeit aus der Route, sonst Schätzung", async () => {
    process.env.MAPS_PROVIDER = "ors";
    process.env.ORS_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ routes: [{ summary: { duration: 1500, distance: 21000 } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const geo = await import("@/lib/geo");
    expect(geo.geoProvider()).toBe("ors");
    const l = await geo.travel({ lat: 50, lon: 8.27 }, { lat: 50.1, lon: 8.5 });
    expect(l).toEqual({ minutes: 28, km: 21, estimated: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v2/directions/driving-car");
    expect((init.headers as Record<string, string>).Authorization).toBe("test-key");
    fetchMock.mockImplementationOnce(async () => new Response("x", { status: 500 }));
    const fallback = await geo.travel({ lat: 50, lon: 8.27 }, { lat: 50.2, lon: 8.6 });
    expect(fallback.estimated).toBe(true);
  });
});
