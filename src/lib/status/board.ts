import { createServerFn } from "@tanstack/react-start";
import type { BoardSnapshot, Health, ServiceSnapshot } from "./types";

const CACHE_TTL_MS = 45_000;

let cache: { expires: number; board: BoardSnapshot } | null = null;
let inflight: Promise<BoardSnapshot> | null = null;

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

async function collectBoard(): Promise<BoardSnapshot> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.board;
  if (inflight) return inflight;

  inflight = (async () => {
    const started = Date.now();
    const { collectAllServices } = await import("./sources.server");
    const services = await collectAllServices();
    const board = assemble(services, Date.now() - started);
    cache = { expires: Date.now() + CACHE_TTL_MS, board };
    return board;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export const fetchStatusBoard = createServerFn({ method: "GET" }).handler(async () => {
  return collectBoard();
});
