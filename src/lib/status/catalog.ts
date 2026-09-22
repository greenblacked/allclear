import type { CategoryId, ServiceId } from "./types.ts";

export type CatalogEntry = {
  id: ServiceId;
  name: string;
  shortName: string;
  category: CategoryId;
  sourceName: string;
  sourceUrl: string;
  blurb: string;
};

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "cloud", label: "Cloud" },
  { id: "gaming", label: "Gaming" },
  { id: "platforms", label: "Platforms" },
  { id: "ai", label: "AI" },
  { id: "updates", label: "Updates" },
];

export const CATALOG: CatalogEntry[] = [
  {
    id: "gcp",
    name: "Google Cloud",
    shortName: "GCP",
    category: "cloud",
    sourceName: "Google Cloud Service Health",
    sourceUrl: "https://status.cloud.google.com/",
    blurb: "Compute, storage, networking, and Google Cloud APIs.",
  },
  {
    id: "aws",
    name: "Amazon Web Services",
    shortName: "AWS",
    category: "cloud",
    sourceName: "AWS Health Dashboard",
    sourceUrl: "https://health.aws.amazon.com/health/status",
    blurb: "Public AWS Health current events across regions.",
  },
  {
    id: "steam",
    name: "Steam",
    shortName: "Steam",
    category: "gaming",
    sourceName: "Steam Web API",
    sourceUrl: "https://store.steampowered.com/",
    blurb: "Store, Web API clock, and platform reachability.",
  },
  {
    id: "cs2-europe",
    name: "CS2 Europe",
    shortName: "CS2 EU",
    category: "gaming",
    sourceName: "Valve SDR config (app 730)",
    sourceUrl: "https://store.steampowered.com/app/730/",
    blurb: "Counter-Strike 2 Steam Datagram relays in Europe.",
  },
  {
    id: "epic",
    name: "Epic Games",
    shortName: "Epic",
    category: "gaming",
    sourceName: "Epic Games Status",
    sourceUrl: "https://status.epicgames.com/",
    blurb: "Accounts, store, online services, and Unreal.",
  },
  {
    id: "fortnite",
    name: "Fortnite",
    shortName: "Fortnite",
    category: "gaming",
    sourceName: "Epic Games Status",
    sourceUrl: "https://status.epicgames.com/",
    blurb: "Fortnite and related Epic game modes.",
  },
  {
    id: "spotify",
    name: "Spotify",
    shortName: "Spotify",
    category: "platforms",
    sourceName: "Spotify Status",
    sourceUrl: "https://spotify.statuspage.io/",
    blurb: "Streaming, accounts, and Spotify APIs.",
  },
  {
    id: "apple",
    name: "Apple",
    shortName: "Apple",
    category: "platforms",
    sourceName: "Apple System Status",
    sourceUrl: "https://www.apple.com/support/systemstatus/",
    blurb: "iCloud, App Store, Apple Account, Media, and Pay.",
  },
  {
    id: "android",
    name: "Android / Play",
    shortName: "Android",
    category: "platforms",
    sourceName: "Google Play Status",
    sourceUrl: "https://status.play.google.com/summary",
    blurb: "Google Play, billing, publishing, and Android services.",
  },
  {
    id: "grok",
    name: "Grok",
    shortName: "Grok",
    category: "ai",
    sourceName: "xAI System Status",
    sourceUrl: "https://status.x.ai/",
    blurb: "Grok, xAI API, and related SpaceXAI surfaces.",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    shortName: "ChatGPT",
    category: "ai",
    sourceName: "OpenAI Status",
    sourceUrl: "https://status.openai.com/",
    blurb: "ChatGPT, OpenAI API, and platform components.",
  },
  {
    id: "claude",
    name: "Claude",
    shortName: "Claude",
    category: "ai",
    sourceName: "Claude Status",
    sourceUrl: "https://status.claude.com/",
    blurb: "Claude apps, API, and Anthropic platform.",
  },
  {
    id: "mikrotik",
    name: "MikroTik RouterOS",
    shortName: "RouterOS",
    category: "updates",
    sourceName: "MikroTik changelogs",
    sourceUrl: "https://mikrotik.com/download/changelogs",
    blurb: "Official RouterOS channel versions and changelogs.",
  },
  {
    id: "apple-os",
    name: "Apple OS",
    shortName: "Apple OS",
    category: "updates",
    sourceName: "Apple Developer Releases",
    sourceUrl: "https://developer.apple.com/news/releases/",
    blurb: "iOS, iPadOS, macOS, watchOS, tvOS, and visionOS releases.",
  },
];

export const CATALOG_BY_ID = Object.fromEntries(
  CATALOG.map((entry) => [entry.id, entry]),
) as Record<ServiceId, CatalogEntry>;
