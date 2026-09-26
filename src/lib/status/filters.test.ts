import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromSearch,
  matchesFilters,
  parseBoardSearch,
  searchFromFilters,
} from "./filters";
import type { Health, ServiceId, ServiceSnapshot } from "./types";

function service(id: ServiceId, health: Health, category: ServiceSnapshot["category"] = "cloud"): ServiceSnapshot {
  return {
    id,
    name: id === "gcp" ? "Google Cloud" : id,
    shortName: id.toUpperCase(),
    category,
    health,
    summary: "All reported systems operational.",
    sourceName: "Source",
    sourceUrl: `https://status.example.com/${id}`,
    checkedAt: "2026-09-25T00:00:00Z",
    latencyMs: 42,
    components: [],
    incidents: [],
  };
}

describe("parseBoardSearch", () => {
  it("keeps valid params", () => {
    expect(parseBoardSearch({ q: "gcp", category: "cloud", issues: true })).toEqual({
      q: "gcp",
      category: "cloud",
      issues: true,
    });
  });

  it("accepts issues as a string and a numeric query as text", () => {
    expect(parseBoardSearch({ q: 730, issues: "true" })).toEqual({ q: "730", issues: true });
  });

  it("drops unknown categories, blank queries, false flags and other params", () => {
    expect(parseBoardSearch({ q: "  ", category: "weather", issues: "false", utm_source: "slack" })).toEqual({});
    expect(parseBoardSearch({ q: ["a"], category: 3, issues: 1 })).toEqual({});
  });

  it("caps a long query", () => {
    expect(parseBoardSearch({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("filters and search params", () => {
  it("round-trip, leaving defaults out of the URL", () => {
    expect(searchFromFilters(DEFAULT_FILTERS)).toEqual({});
    expect(filtersFromSearch({})).toEqual(DEFAULT_FILTERS);
    const filters = { query: "claude", category: "ai" as const, issuesOnly: true };
    expect(filtersFromSearch(searchFromFilters(filters))).toEqual(filters);
  });

  it("does not put a whitespace-only query in the URL", () => {
    expect(searchFromFilters({ ...DEFAULT_FILTERS, query: "   " })).toEqual({});
  });
});

describe("matchesFilters", () => {
  const gcp = service("gcp", "degraded");
  const steam = service("steam", "operational", "gaming");

  it("matches everything by default", () => {
    expect(matchesFilters(gcp, DEFAULT_FILTERS)).toBe(true);
    expect(matchesFilters(steam, DEFAULT_FILTERS)).toBe(true);
  });

  it("filters by category, issues and case-insensitive text", () => {
    expect(matchesFilters(steam, { ...DEFAULT_FILTERS, category: "cloud" })).toBe(false);
    expect(matchesFilters(steam, { ...DEFAULT_FILTERS, issuesOnly: true })).toBe(false);
    expect(matchesFilters(gcp, { ...DEFAULT_FILTERS, issuesOnly: true })).toBe(true);
    expect(matchesFilters(gcp, { ...DEFAULT_FILTERS, query: "  GOOGLE " })).toBe(true);
    expect(matchesFilters(gcp, { ...DEFAULT_FILTERS, query: "steam" })).toBe(false);
  });
});
