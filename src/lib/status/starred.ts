import { CATALOG } from "./catalog.ts";
import type { ServiceId, ServiceSnapshot } from "./types.ts";

export const STARRED_STORAGE_KEY = "status-bar:starred";

const KNOWN = new Set<string>(CATALOG.map((entry) => entry.id));

/**
 * Reads the stored list. Anything unreadable, or an id the board no longer
 * has, is dropped rather than failing: storage is the visitor's to edit.
 */
export function parseStarred(raw: string | null): ReadonlySet<ServiceId> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((id): id is ServiceId => typeof id === "string" && KNOWN.has(id)));
  } catch {
    return new Set();
  }
}

/** Stored in catalog order, so the same stars always store the same way. */
export function serializeStarred(starred: ReadonlySet<ServiceId>): string {
  return JSON.stringify(CATALOG.map((entry) => entry.id).filter((id) => starred.has(id)));
}

export function toggleStarred(starred: ReadonlySet<ServiceId>, id: ServiceId): ReadonlySet<ServiceId> {
  const next = new Set(starred);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Starred services first; the order within each part is kept. */
export function starredFirst(services: ServiceSnapshot[], starred: ReadonlySet<ServiceId>): ServiceSnapshot[] {
  if (starred.size === 0) return services;
  return [
    ...services.filter((service) => starred.has(service.id)),
    ...services.filter((service) => !starred.has(service.id)),
  ];
}
