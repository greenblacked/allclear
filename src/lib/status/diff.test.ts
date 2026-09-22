import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffBoards, overallHealth } from "./diff.ts";
import type { BoardSnapshot, ServiceSnapshot } from "./types.ts";

function service(partial: Partial<ServiceSnapshot> & Pick<ServiceSnapshot, "id" | "health">): ServiceSnapshot {
  return {
    name: partial.id,
    shortName: partial.id,
    category: "cloud",
    summary: partial.summary ?? "ok",
    sourceName: "test",
    sourceUrl: "https://example.com",
    checkedAt: "2026-09-22T12:00:00.000Z",
    latencyMs: 10,
    components: [],
    incidents: [],
    ...partial,
  };
}

function board(services: ServiceSnapshot[]): BoardSnapshot {
  return {
    generatedAt: "2026-09-22T12:00:00.000Z",
    durationMs: 100,
    services,
    counts: { operational: 0, degraded: 0, outage: 0, maintenance: 0, unknown: 0 },
  };
}

describe("diffBoards", () => {
  it("reports only health transitions", () => {
    const previous = board([
      service({ id: "aws", health: "operational" }),
      service({ id: "gcp", health: "operational" }),
    ]);
    const next = board([
      service({ id: "aws", health: "degraded", summary: "eu-west-1 impact" }),
      service({ id: "gcp", health: "operational" }),
    ]);
    assert.deepEqual(diffBoards(previous, next), [
      {
        id: "aws",
        name: "aws",
        from: "operational",
        to: "degraded",
        summary: "eu-west-1 impact",
      },
    ]);
  });

  it("treats the worst service as overall health", () => {
    assert.equal(
      overallHealth(
        board([
          service({ id: "aws", health: "degraded" }),
          service({ id: "gcp", health: "outage" }),
        ]),
      ),
      "outage",
    );
  });

  it("reports a new official version even when health is unchanged", () => {
    const previous = board([
      service({
        id: "mikrotik",
        health: "operational",
        meta: { latest: "7.24.3", versions: "RouterOS 7 stable=7.24.3" },
      }),
    ]);
    const next = board([
      service({
        id: "mikrotik",
        health: "operational",
        summary: "Latest RouterOS 7.24.4",
        meta: { latest: "7.24.4", versions: "RouterOS 7 stable=7.24.4" },
      }),
    ]);
    assert.deepEqual(diffBoards(previous, next), [
      {
        id: "mikrotik",
        name: "mikrotik",
        from: "operational",
        to: "operational",
        summary: "RouterOS 7 stable 7.24.4",
      },
    ]);
  });
});
