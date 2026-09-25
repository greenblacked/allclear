import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { CACHE_MAX_STALE_MS, CACHE_TTL_MS, MIN_FORCED_REFRESH_MS } from "./schedule";
import { createTtlCache } from "./ttl-cache";
import type { BoardSnapshot, Health, ServiceSnapshot } from "./types";

function emptyCounts(): Record<Health, number> {
  return { operational: 0, degraded: 0, outage: 0, maintenance: 0, unknown: 0 };
}

function assemble(services: ServiceSnapshot[], durationMs: number): BoardSnapshot {
  const counts = emptyCounts();
  for (const service of services) counts[service.health] += 1;
  return {
    generatedAt: new Date().toISOString(),
    durationMs,
    services,
    counts,
  };
}

const boardCache = createTtlCache(async () => {
  const started = Date.now();
  const { collectAllServices } = await import("./sources.server");
  const services = await collectAllServices();
  return assemble(services, Date.now() - started);
}, CACHE_TTL_MS, { maxStaleMs: CACHE_MAX_STALE_MS, minForceIntervalMs: MIN_FORCED_REFRESH_MS });

/**
 * The same cached board the page reads, for server routes (the JSON API, the
 * feed and the badges). Sharing the cache is what keeps a busy badge from
 * costing a vendor sweep per request. Server-only, so the client bundle
 * drops the cache and the collectors it would otherwise pull in.
 */
export const getStatusBoard = createServerOnlyFn(
  (): Promise<BoardSnapshot> => boardCache.get({ allowStale: true }),
);

export const fetchStatusBoard = createServerFn({ method: "GET" }).handler(async () => {
  return boardCache.get();
});

// The route loader only: renders at once from a recently expired snapshot
// instead of blocking the first paint on a full vendor sweep.
export const loadStatusBoardForPage = createServerFn({ method: "GET" }).handler(async () => {
  return boardCache.get({ allowStale: true });
});

export const refreshStatusBoard = createServerFn({ method: "POST" }).handler(async () => {
  return boardCache.get({ force: true });
});
