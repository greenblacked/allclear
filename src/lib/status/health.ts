import type { Health } from "./types.ts";

const RANK: Record<Health, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  unknown: 3,
  outage: 4,
};

export function worseHealth(a: Health, b: Health): Health {
  return RANK[a] >= RANK[b] ? a : b;
}

export function healthLabel(health: Health): string {
  switch (health) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "outage":
      return "Outage";
    case "maintenance":
      return "Maintenance";
    default:
      return "Unknown";
  }
}

export function statuspageIndicator(indicator: string | undefined): Health {
  switch ((indicator ?? "none").toLowerCase()) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
      return "outage";
    case "critical":
      return "outage";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

export function statuspageComponent(status: string | undefined): Health {
  switch ((status ?? "").toLowerCase()) {
    case "operational":
      return "operational";
    case "degraded_performance":
    case "partial_outage":
      return "degraded";
    case "major_outage":
      return "outage";
    case "under_maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

export function googleImpact(impact: string | undefined, severity?: string): Health {
  const value = (impact ?? severity ?? "").toUpperCase();
  if (value.includes("SERVICE_OUTAGE") || value === "CRITICAL" || value === "HIGH") {
    return value.includes("SERVICE_OUTAGE") || value === "CRITICAL" ? "outage" : "degraded";
  }
  if (value.includes("SERVICE_DISRUPTION") || value === "MEDIUM") return "degraded";
  if (value.includes("MAINTENANCE")) return "maintenance";
  if (value.includes("AVAILABLE") || value === "LOW") return "degraded";
  return "degraded";
}

export function overallSummary(health: Health, incidentCount: number, componentHint?: string): string {
  if (health === "operational") {
    return incidentCount > 0
      ? `Clear. ${incidentCount} recently resolved item${incidentCount === 1 ? "" : "s"}.`
      : "All reported systems operational.";
  }
  if (health === "maintenance") {
    return componentHint ?? "Scheduled maintenance is in progress.";
  }
  if (health === "degraded") {
    return componentHint ?? "Degraded performance on one or more components.";
  }
  if (health === "outage") {
    return componentHint ?? "An outage is affecting this service.";
  }
  return "Status could not be confirmed from the official source.";
}
