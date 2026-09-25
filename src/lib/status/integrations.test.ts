import { describe, expect, it } from "vitest";
import { atomFeed, publicStatus, shieldsBadge } from "./integrations";
import type { BoardSnapshot, Health, ServiceId, ServiceSnapshot } from "./types";

function service(id: ServiceId, health: Health, extra: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
  return {
    id,
    name: id === "gcp" ? "Google Cloud" : id,
    shortName: id.toUpperCase(),
    category: "cloud",
    health,
    summary: "All reported systems operational.",
    sourceName: "Source",
    sourceUrl: `https://status.example.com/${id}`,
    checkedAt: "2026-09-25T00:00:00Z",
    latencyMs: 42,
    components: [{ name: "internal", health }],
    incidents: [],
    meta: { secret: "collector detail" },
    ...extra,
  };
}

function board(services: ServiceSnapshot[]): BoardSnapshot {
  const counts = { operational: 0, degraded: 0, outage: 0, maintenance: 0, unknown: 0 };
  for (const item of services) counts[item.health] += 1;
  return { generatedAt: "2026-09-25T00:00:00.000Z", durationMs: 1, services, counts };
}

describe("publicStatus", () => {
  it("publishes health, headline and incidents, but not collector internals", () => {
    const status = publicStatus(
      board([
        service("gcp", "degraded", {
          summary: "Elevated errors",
          incidents: [{ id: "1", title: "Elevated errors", health: "degraded", url: "https://x/1" }],
        }),
        service("aws", "operational"),
      ]),
    );
    expect(status.overall).toBe("degraded");
    expect(status.headline).toBe("Degraded: Google Cloud");
    expect(status.services[0]).toEqual({
      id: "gcp",
      name: "Google Cloud",
      category: "cloud",
      health: "degraded",
      summary: "Elevated errors",
      source: "https://status.example.com/gcp",
      incidents: [{ title: "Elevated errors", health: "degraded", url: "https://x/1", startedAt: undefined }],
    });
    expect(JSON.stringify(status)).not.toMatch(/latencyMs|components|collector detail/);
  });
});

describe("shieldsBadge", () => {
  const snapshot = board([service("gcp", "outage"), service("aws", "operational")]);

  it("describes one service in Shields endpoint format", () => {
    expect(shieldsBadge(snapshot, "aws")).toEqual({ schemaVersion: 1, label: "aws", message: "operational", color: "brightgreen" });
    expect(shieldsBadge(snapshot, "gcp")).toMatchObject({ message: "outage", color: "red" });
  });

  it("summarises the whole board under the id 'board'", () => {
    expect(shieldsBadge(snapshot, "board")).toMatchObject({ label: "status", message: "outage: google cloud", color: "red" });
    expect(shieldsBadge(board([service("aws", "operational")]), "board")).toMatchObject({
      message: "all operational",
      color: "brightgreen",
    });
  });

  it("returns a well-formed error badge for an unknown id", () => {
    expect(shieldsBadge(snapshot, "nope")).toMatchObject({ isError: true, message: "unknown service" });
  });
});

describe("atomFeed", () => {
  it("has one entry per service that needs attention, with escaped text and absolute links", () => {
    const xml = atomFeed(
      board([
        service("gcp", "degraded", {
          summary: 'Errors & "timeouts" <eu>',
          incidents: [{ id: "1", title: "t", health: "degraded", url: "https://x/1?a=1&b=2", updatedAt: "2026-09-24T23:00:00Z" }],
        }),
        service("aws", "operational"),
      ]),
      "https://status.example.org/",
    );
    expect(xml).toContain('<link rel="self" href="https://status.example.org/feed.xml"/>');
    expect(xml.match(/<entry>/g)).toHaveLength(1);
    expect(xml).toContain("<title>Google Cloud: Degraded</title>");
    expect(xml).toContain("<summary>Errors &amp; &quot;timeouts&quot; &lt;eu&gt;</summary>");
    expect(xml).toContain('href="https://x/1?a=1&amp;b=2"');
    expect(xml).toContain("<updated>2026-09-24T23:00:00.000Z</updated>");
  });

  it("gives an entry a new id when its message changes, so readers post it again", () => {
    const id = (summary: string) =>
      atomFeed(board([service("gcp", "degraded", { summary })]), "https://s").match(/<id>(urn:[^<]+)<\/id>/)?.[1];
    expect(id("Investigating")).not.toBe(id("Mitigated"));
    expect(id("Investigating")).toBe(id("Investigating"));
  });

  it("falls back to the board time when a vendor timestamp does not parse", () => {
    const xml = atomFeed(
      board([service("gcp", "outage", { incidents: [{ id: "1", title: "t", health: "outage", updatedAt: "yesterday-ish" }] })]),
      "https://s",
    );
    expect(xml).toContain("<updated>2026-09-25T00:00:00.000Z</updated>");
  });

  it("is a valid empty feed when everything is operational", () => {
    const xml = atomFeed(board([service("aws", "operational")]), "https://s");
    expect(xml).not.toContain("<entry>");
    expect(xml.trim().endsWith("</feed>")).toBe(true);
  });
});
