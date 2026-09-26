import { CATEGORIES } from "./catalog.ts";
import type { CategoryId, ServiceSnapshot } from "./types.ts";

/** What the board's search box and filter buttons are set to. */
export type BoardFilters = {
  query: string;
  category: "all" | CategoryId;
  issuesOnly: boolean;
};

export const DEFAULT_FILTERS: BoardFilters = { query: "", category: "all", issuesOnly: false };

/**
 * The same filters as URL search params, so a filtered board can be
 * bookmarked or pasted into a chat: `/?q=gcp&category=cloud&issues=true`.
 * A filter at its default is left out, which keeps the plain board at `/`.
 */
export type BoardSearch = {
  q?: string;
  category?: CategoryId;
  issues?: true;
};

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id));

function isCategory(value: unknown): value is CategoryId {
  return typeof value === "string" && CATEGORY_IDS.has(value);
}

/**
 * The route's `validateSearch`: keeps what it understands and drops the
 * rest, so a hand-edited or stale link opens the board instead of an error.
 */
export function parseBoardSearch(raw: Record<string, unknown>): BoardSearch {
  const search: BoardSearch = {};
  // The router parses `?q=123` as a number; a search for it is still text.
  const q = typeof raw.q === "number" ? String(raw.q) : raw.q;
  if (typeof q === "string" && q.trim()) search.q = q.slice(0, 100);
  if (isCategory(raw.category)) search.category = raw.category;
  if (raw.issues === true || raw.issues === "true") search.issues = true;
  return search;
}

export function filtersFromSearch(search: BoardSearch): BoardFilters {
  return {
    query: search.q ?? "",
    category: search.category ?? "all",
    issuesOnly: search.issues === true,
  };
}

export function searchFromFilters(filters: BoardFilters): BoardSearch {
  const search: BoardSearch = {};
  if (filters.query.trim()) search.q = filters.query;
  if (filters.category !== "all") search.category = filters.category;
  if (filters.issuesOnly) search.issues = true;
  return search;
}

export function matchesFilters(service: ServiceSnapshot, filters: BoardFilters): boolean {
  if (filters.category !== "all" && service.category !== filters.category) return false;
  if (filters.issuesOnly && service.health === "operational") return false;
  const needle = filters.query.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${service.name} ${service.shortName} ${service.summary} ${service.category}`.toLowerCase();
  return hay.includes(needle);
}
