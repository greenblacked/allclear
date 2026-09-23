import { createServerFn } from "@tanstack/react-start";
import { CACHE_TTL_MS } from "./schedule";
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
}, CACHE_TTL_MS);

export const fetchStatusBoard = createServerFn({ method: "GET" }).handler(async () => {
  return boardCache.get();
});

export const refreshStatusBoard = createServerFn({ method: "POST" }).handler(async () => {
  return boardCache.get({ force: true });
});
