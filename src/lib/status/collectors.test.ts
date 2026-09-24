import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectAllServices } from "./sources.server.ts";

// Vendor endpoints used by src/lib/status/sources.server.ts collectors.
// Keep these in sync with the URLs the collectors actually fetch.
const URLS = {
  steamServerInfo: "https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/",
  steamFeatured: "https://store.steampowered.com/api/featured/",
  cs2Sdr: "https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=730",
  cs2Players: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=730",
};

type Handler = () => Response | Promise<Response>;

function json(body: unknown, init: { status?: number; statusText?: string } = {}): Handler {
  return () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      statusText: init.statusText,
      headers: { "content-type": "application/json" },
    });
}

function text(body: string, init: { status?: number; statusText?: string } = {}): Handler {
  return () =>
    new Response(body, {
      status: init.status ?? 200,
      statusText: init.statusText,
      headers: { "content-type": "text/xml" },
    });
}

// Simulates a network-level failure (DNS, connection reset, …) rather than
// an HTTP error response: the handler rejects instead of returning a Response.
function networkError(message = "fetch failed"): Handler {
  return () => Promise.reject(new TypeError(message));
}

function stubFetch(routes: Partial<Record<string, Handler>>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const handler = routes[url];
    if (!handler) return new Response("not found", { status: 404, statusText: "Not Found" });
    return handler();
  });
}

describe("collectAllServices against stubbed vendor payloads", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Steam: both endpoints returning a well-shaped payload is operational", async () => {
    stubFetch({
      [URLS.steamServerInfo]: json({ servertime: 1758000000 }),
      [URLS.steamFeatured]: json({ featured_win: [{ id: 1 }] }),
    });
    const services = await collectAllServices();
    expect(services.find((s) => s.id === "steam")!.health).toBe("operational");
  });

  it("Steam: one endpoint answering with the wrong shape (still 200) is degraded", async () => {
    stubFetch({
      [URLS.steamServerInfo]: json({ servertime: 1758000000 }),
      [URLS.steamFeatured]: json({ not_featured_win: [] }), // wrong shape, still HTTP 200
    });
    const services = await collectAllServices();
    expect(services.find((s) => s.id === "steam")!.health).toBe("degraded");
  });

  it("Steam: a 503 from one endpoint is degraded, with that endpoint's component non-operational", async () => {
    stubFetch({
      [URLS.steamServerInfo]: json({ servertime: 1758000000 }),
      [URLS.steamFeatured]: text("service unavailable", { status: 503, statusText: "Service Unavailable" }),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("degraded");
    expect(snapshot.components.find((c) => c.name === "Steam Store")).toMatchObject({
      health: "outage",
      detail: "503 Service Unavailable from store.steampowered.com",
    });
    expect(snapshot.components.find((c) => c.name === "Steam Web API")?.health).toBe("operational");
  });

  it("Steam: a network error on one endpoint is degraded, with that endpoint's component non-operational", async () => {
    stubFetch({
      [URLS.steamServerInfo]: networkError(),
      [URLS.steamFeatured]: json({ featured_win: [{ id: 1 }] }),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("degraded");
    expect(snapshot.components.find((c) => c.name === "Steam Web API")?.health).toBe("outage");
    expect(snapshot.components.find((c) => c.name === "Steam Store")?.health).toBe("operational");
  });

  it("Steam: a null body (still 200) on one endpoint is degraded, not a TypeError", async () => {
    stubFetch({
      [URLS.steamServerInfo]: json({ servertime: 1758000000 }),
      [URLS.steamFeatured]: json(null),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("degraded");
    expect(snapshot.components.find((c) => c.name === "Steam Store")?.detail).toBe("Unexpected response shape.");
  });

  it("Steam: a rejection on one endpoint and a wrong shape on the other reports the rejection", async () => {
    stubFetch({
      [URLS.steamServerInfo]: text("service unavailable", { status: 503, statusText: "Service Unavailable" }),
      [URLS.steamFeatured]: json(null),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("unknown");
    expect(snapshot.failure).toMatchObject({ kind: "http", status: 503 });
  });

  it("Steam: both endpoints answering with the wrong shape (still 200) is unknown with a parser failure", async () => {
    stubFetch({
      [URLS.steamServerInfo]: json({ servertime: "not-a-number" }),
      [URLS.steamFeatured]: json({ not_featured_win: [] }),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("unknown");
    expect(snapshot.failure?.kind).toBe("parser");
  });

  it("Steam: both endpoints returning a 503 is unknown with an http failure", async () => {
    stubFetch({
      [URLS.steamServerInfo]: text("service unavailable", { status: 503, statusText: "Service Unavailable" }),
      [URLS.steamFeatured]: text("service unavailable", { status: 503, statusText: "Service Unavailable" }),
    });
    const services = await collectAllServices();
    const snapshot = services.find((s) => s.id === "steam")!;
    expect(snapshot.health).toBe("unknown");
    expect(snapshot.failure?.kind).toBe("http");
    expect(snapshot.failure?.status).toBe(503);
  });

  type PopFixture = { desc: string; geo: number[]; relays: Array<{ ipv4: string }> };

  // All 11 codes in sources.server.ts's EU_POPS set, so "N EU pops" fixtures
  // below don't depend on the description/geo fallback matching too.
  const ALL_EU_POP_CODES = ["ams", "fra", "fsn", "hel", "lhr", "mad", "par", "sto", "sto2", "vie", "waw"];

  function euPops(codes: string[], relayingCount: number): Record<string, PopFixture> {
    const pops: Record<string, PopFixture> = {};
    codes.forEach((code, index) => {
      pops[code] = {
        desc: `${code.toUpperCase()} Europe`,
        geo: [10, 50],
        relays: index < relayingCount ? [{ ipv4: "1.2.3.4" }] : [],
      };
    });
    return pops;
  }

  describe("CS2 Europe", () => {
    it("11 EU pops, 4 relaying, is degraded (below 40%)", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES, 4) }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      expect(services.find((s) => s.id === "cs2-europe")!.health).toBe("degraded");
    });

    it("11 EU pops, 5 relaying, is operational (pins the 40% threshold)", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES, 5) }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      expect(services.find((s) => s.id === "cs2-europe")!.health).toBe("operational");
    });

    it("5 EU pops, 3 relaying, is operational", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 3) }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.health).toBe("operational");
      expect(snapshot.meta?.euWithRelays).toBe(3);
    });

    it("5 EU pops, 2 relaying, is degraded (pins the absolute floor of 3)", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 2) }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      expect(services.find((s) => s.id === "cs2-europe")!.health).toBe("degraded");
    });

    it("excludes a non-European pop from the European count", async () => {
      const pops: Record<string, PopFixture> = euPops(ALL_EU_POP_CODES.slice(0, 5), 5);
      pops.iad = { desc: "Sterling (Washington DC)", geo: [-77.5, 39.0], relays: [{ ipv4: "5.6.7.8" }] };
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.meta?.euPops).toBe(5);
      expect(snapshot.components.some((c) => c.name === "Sterling (Washington DC)")).toBe(false);
    });

    it("is an outage when the relay config reports failure", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: false, pops: euPops(ALL_EU_POP_CODES, 11) }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      expect(services.find((s) => s.id === "cs2-europe")!.health).toBe("outage");
    });

    it("is an outage when no European pops are listed", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: {} }),
        [URLS.cs2Players]: json({ response: { player_count: 500000, result: 1 } }),
      });
      const services = await collectAllServices();
      expect(services.find((s) => s.id === "cs2-europe")!.health).toBe("outage");
    });

    it("stays operational without a player count when that endpoint has a network error", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 5) }),
        [URLS.cs2Players]: networkError(),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.health).toBe("operational");
      expect(snapshot.summary).not.toContain("playing");
      expect(snapshot.meta?.players).toBe(0);
    });

    it("ignores a player count that is not a number", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 5) }),
        [URLS.cs2Players]: json({ response: { player_count: "lots", result: 1 } }),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.health).toBe("operational");
      expect(snapshot.meta?.players).toBe(0);
    });

    it("an SDR-healthy card stays operational when the player count endpoint 503s", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 5) }),
        [URLS.cs2Players]: text("service unavailable", { status: 503, statusText: "Service Unavailable" }),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.health).toBe("operational");
    });

    it("an SDR-healthy card stays operational when the player count body is null", async () => {
      stubFetch({
        [URLS.cs2Sdr]: json({ success: true, pops: euPops(ALL_EU_POP_CODES.slice(0, 5), 5) }),
        [URLS.cs2Players]: json(null),
      });
      const services = await collectAllServices();
      const snapshot = services.find((s) => s.id === "cs2-europe")!;
      expect(snapshot.health).toBe("operational");
    });
  });
});
