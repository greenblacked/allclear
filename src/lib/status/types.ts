export type ServiceId =
  | "gcp"
  | "aws"
  | "steam"
  | "cs2-europe"
  | "epic"
  | "fortnite"
  | "spotify"
  | "apple"
  | "android"
  | "grok"
  | "chatgpt"
  | "claude";

export type CategoryId = "cloud" | "gaming" | "platforms" | "ai";

export type Health = "operational" | "degraded" | "outage" | "maintenance" | "unknown";

export type ComponentHealth = {
  name: string;
  health: Health;
  detail?: string;
};

export type Incident = {
  id: string;
  title: string;
  health: Health;
  startedAt?: string;
  updatedAt?: string;
  url?: string;
};

export type ServiceSnapshot = {
  id: ServiceId;
  name: string;
  shortName: string;
  category: CategoryId;
  health: Health;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
  latencyMs: number;
  components: ComponentHealth[];
  incidents: Incident[];
  meta?: Record<string, string | number>;
};

export type BoardSnapshot = {
  generatedAt: string;
  durationMs: number;
  services: ServiceSnapshot[];
  counts: Record<Health, number>;
};
