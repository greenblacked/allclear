import { CATALOG_BY_ID } from "./catalog.ts";
import {
  formatReleaseAge,
  formatVersionMap,
  isFreshRelease,
  latestAppleOsByFamily,
  MIKROTIK_CHANNELS,
  parseMikrotikNewest,
  summarizeMikrotikChangelog,
} from "./changelog.ts";
import { fetchJson, fetchText, SourceError } from "./http.ts";
import {
  googleImpact,
  overallSummary,
  statuspageComponent,
  statuspageIndicator,
  worseHealth,
} from "./health.ts";
import type {
  ComponentHealth,
  Health,
  Incident,
  ServiceId,
  ServiceSnapshot,
} from "./types.ts";

const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const EU_POPS = new Set(["ams", "fra", "fsn", "hel", "lhr", "mad", "par", "sto", "sto2", "vie", "waw"]);

type StatuspageSummary = {
  status?: { indicator?: string; description?: string };
  components?: Array<{
    id: string;
    name: string;
    status: string;
    group?: boolean;
    group_id?: string | null;
  }>;
  incidents?: Array<{
    id: string;
    name: string;
    status: string;
    impact?: string;
    shortlink?: string;
    started_at?: string;
    updated_at?: string;
  }>;
  scheduled_maintenances?: Array<{
    id: string;
    name: string;
    status: string;
    started_at?: string;
    updated_at?: string;
    shortlink?: string;
  }>;
};

type GoogleIncident = {
  id: string;
  begin?: string;
  end?: string | null;
  modified?: string;
  external_desc?: string;
  status_impact?: string;
  severity?: string;
  service_name?: string;
  uri?: string;
  currently_affected_locations?: Array<{ title?: string }>;
};

type AwsEvent = {
  date?: string;
  arn?: string;
  region_name?: string;
  status?: string;
  service?: string;
  service_name?: string;
  summary?: string;
  end_time?: string | number | null;
  event_log?: Array<{ summary?: string; message?: string; status?: number; timestamp?: number }>;
};

type AppleStatus = {
  services?: Array<{
    serviceName: string;
    events?: Array<{
      eventStatus?: string;
      statusType?: string;
      message?: string;
      usersAffected?: string;
      epochStartDate?: number;
      datePosted?: string;
    }>;
  }>;
};

type SteamSdr = {
  success?: boolean;
  pops?: Record<
    string,
    {
      desc?: string;
      geo?: number[];
      tier?: number;
      relays?: Array<{ ipv4?: string }>;
    }
  >;
};

function base(id: ServiceId, checkedAt: string, latencyMs: number): Omit<
  ServiceSnapshot,
  "health" | "summary" | "components" | "incidents"
> {
  const entry = CATALOG_BY_ID[id];
  return {
    id: entry.id,
    name: entry.name,
    shortName: entry.shortName,
    category: entry.category,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
    checkedAt,
    latencyMs,
  };
}

function failed(id: ServiceId, started: number, error: unknown): ServiceSnapshot {
  const message = error instanceof SourceError ? error.message : "Official source did not respond.";
  return {
    ...base(id, new Date().toISOString(), Date.now() - started),
    health: "unknown",
    summary: message,
    components: [],
    incidents: [],
  };
}

function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = Date.now();
  return fn().then((value) => ({ value, ms: Date.now() - started }));
}

function googleIncidents(incidents: GoogleIncident[], sourceRoot: string) {
  const open = incidents.filter((incident) => !incident.end);
  let health: Health = "operational";
  const components: ComponentHealth[] = [];
  const mapped: Incident[] = open.map((incident) => {
    const itemHealth = googleImpact(incident.status_impact, incident.severity);
    health = worseHealth(health, itemHealth);
    const locations = (incident.currently_affected_locations ?? [])
      .map((loc) => loc.title)
      .filter(Boolean)
      .join(", ");
    components.push({
      name: incident.service_name ?? "Service",
      health: itemHealth,
      detail: locations || incident.external_desc,
    });
    return {
      id: incident.id,
      title: incident.external_desc ?? incident.service_name ?? "Incident",
      health: itemHealth,
      startedAt: incident.begin,
      updatedAt: incident.modified,
      url: incident.uri ? `${sourceRoot.replace(/\/$/, "")}${incident.uri}` : sourceRoot,
    };
  });
  return { health, incidents: mapped, components };
}

function fromStatuspage(
  id: ServiceId,
  data: StatuspageSummary,
  latencyMs: number,
  componentFilter?: (name: string, group?: boolean) => boolean,
): ServiceSnapshot {
  const checkedAt = new Date().toISOString();
  const components = (data.components ?? [])
    .filter((component) => (componentFilter ? componentFilter(component.name, component.group) : !component.group))
    .map((component) => ({
      name: component.name,
      health: statuspageComponent(component.status),
    }));

  // Do not truncate here: the card below ranks non-operational components
  // first and then caps the list. Slicing to 8 up front dropped a broken
  // component that sorted past index 8 on a vendor with many components.
  let health = componentFilter
    ? components.reduce((acc, component) => worseHealth(acc, component.health), "operational" as Health)
    : statuspageIndicator(data.status?.indicator);

  if (componentFilter && components.length === 0) {
    health = statuspageIndicator(data.status?.indicator);
  }

  const activeIncidents = (data.incidents ?? []).filter((incident) => {
    const status = incident.status.toLowerCase();
    return status !== "resolved" && status !== "postmortem" && status !== "completed";
  });

  const incidents: Incident[] = activeIncidents
    .filter((incident) => {
      if (!componentFilter) return true;
      return componentFilter(incident.name, false);
    })
    .map((incident) => ({
      id: incident.id,
      title: incident.name,
      health: statuspageIndicator(incident.impact),
      startedAt: incident.started_at,
      updatedAt: incident.updated_at,
      url: incident.shortlink,
    }));

  const maintenances = (data.scheduled_maintenances ?? []).filter((item) => {
    const status = item.status.toLowerCase();
    return status === "in_progress" || status === "verifying";
  });

  if (maintenances.length && health === "operational") health = "maintenance";

  const hint = incidents[0]?.title ?? data.status?.description;
  return {
    ...base(id, checkedAt, latencyMs),
    health,
    summary: overallSummary(health, incidents.length, hint),
    components: components.filter((component) => component.health !== "operational").concat(
      components.filter((component) => component.health === "operational").slice(0, 4),
    ).slice(0, 8),
    incidents,
  };
}

async function collectGcp(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<GoogleIncident[]>("https://status.cloud.google.com/incidents.json"),
    );
    const parsed = googleIncidents(value, "https://status.cloud.google.com");
    return {
      ...base("gcp", new Date().toISOString(), ms),
      health: parsed.health,
      summary: overallSummary(parsed.health, parsed.incidents.length, parsed.incidents[0]?.title),
      components: parsed.components.slice(0, 8),
      incidents: parsed.incidents,
    };
  } catch (error) {
    return failed("gcp", started, error);
  }
}

export function awsEventActive(event: AwsEvent, now: number): boolean {
  if (event.end_time) return false;
  const summary = event.summary ?? "";
  if (/^\[resolved\]/i.test(summary)) return false;
  const last = event.event_log?.at(-1);
  const lastTs = (last?.timestamp ?? Number(event.date ?? 0)) * 1000;
  if (!lastTs || now - lastTs > STALE_MS) return false;
  const lastMessage = `${last?.summary ?? ""} ${last?.message ?? ""}`.toLowerCase();
  // `Number(undefined)` is NaN and `NaN !== 0` is true, so an event missing
  // `status` used to count as active. Fall back to the update text instead.
  // null and "" coerce to 0, which would read as resolved, so only a real
  // number or a non-blank numeric string counts as a reported status.
  const raw = event.status as unknown;
  const status =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : Number.NaN;
  if (!Number.isFinite(status)) return !lastMessage.includes("resolved");
  if (lastMessage.includes("resolved") && status === 0) return false;
  return status !== 0;
}

function awsHealthFromEvent(event: AwsEvent): Health {
  const text = `${event.summary ?? ""} ${event.event_log?.at(-1)?.message ?? ""}`.toLowerCase();
  const region = (event.region_name ?? "").trim();
  if (text.includes("maintenance")) return "maintenance";
  // Regional Health items (one AZ / one region) are impact, not a global outage.
  if (region || /region availability/.test(text) || /availability zone/.test(text)) {
    return "degraded";
  }
  if (text.includes("outage") || text.includes("unavailable")) return "outage";
  return "degraded";
}

async function collectAws(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<AwsEvent[]>("https://health.aws.amazon.com/public/currentevents", { binary: true }),
    );
    const now = Date.now();
    const active = value.filter((event) => awsEventActive(event, now));
    let health: Health = "operational";
    const incidents: Incident[] = active.map((event) => {
      const itemHealth = awsHealthFromEvent(event);
      health = worseHealth(health, itemHealth);
      const last = event.event_log?.at(-1);
      return {
        id: event.arn ?? event.summary ?? crypto.randomUUID(),
        title: `${event.service_name ?? event.service ?? "AWS"} — ${event.summary ?? last?.summary ?? "Event"}`,
        health: itemHealth,
        startedAt: event.date ? new Date(Number(event.date) * 1000).toISOString() : undefined,
        updatedAt: last?.timestamp ? new Date(last.timestamp * 1000).toISOString() : undefined,
        url: "https://health.aws.amazon.com/health/status",
      };
    });
    return {
      ...base("aws", new Date().toISOString(), ms),
      health,
      summary: overallSummary(
        health,
        incidents.length,
        incidents[0]?.title ?? `${value.length} public Health items, none currently active.`,
      ),
      components: active.slice(0, 8).map((event) => ({
        name: `${event.service_name ?? "Service"} (${event.region_name ?? "global"})`,
        health: awsHealthFromEvent(event),
        detail: event.summary,
      })),
      incidents,
      meta: { publicEvents: value.length, active: active.length },
    };
  } catch (error) {
    return failed("aws", started, error);
  }
}

async function collectSteam(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const [info, store] = await Promise.all([
      timed(() => fetchJson<{ servertime?: number }>("https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/")),
      timed(() =>
        fetchJson<{ featured_win?: unknown[] }>("https://store.steampowered.com/api/featured/"),
      ),
    ]);
    const ms = Math.max(info.ms, store.ms);
    const apiOk = typeof info.value.servertime === "number";
    const storeOk = Array.isArray(store.value.featured_win);
    let health: Health = apiOk && storeOk ? "operational" : apiOk || storeOk ? "degraded" : "outage";
    const components: ComponentHealth[] = [
      { name: "Steam Web API", health: apiOk ? "operational" : "outage" },
      { name: "Steam Store", health: storeOk ? "operational" : "outage" },
    ];
    return {
      ...base("steam", new Date().toISOString(), ms),
      health,
      summary: overallSummary(health, 0, health === "operational" ? "Web API and Store responding." : undefined),
      components,
      incidents: [],
      meta: { servertime: info.value.servertime ?? 0 },
    };
  } catch (error) {
    return failed("steam", started, error);
  }
}

function isEuropePop(code: string, desc: string, geo?: number[]): boolean {
  if (EU_POPS.has(code.toLowerCase())) return true;
  if (/(netherlands|germany|finland|england|spain|france|sweden|austria|poland|europe)/i.test(desc)) {
    return true;
  }
  if (!geo || geo.length < 2) return false;
  const [lon, lat] = geo;
  return lat >= 35 && lat <= 72 && lon >= -25 && lon <= 45;
}

async function collectCs2Europe(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const [sdr, players] = await Promise.all([
      timed(() => fetchJson<SteamSdr>("https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=730")),
      timed(() =>
        fetchJson<{ response?: { player_count?: number; result?: number } }>(
          "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=730",
        ),
      ),
    ]);
    const ms = Math.max(sdr.ms, players.ms);
    const pops = sdr.value.pops ?? {};
    const europe = Object.entries(pops)
      .filter(([code, pop]) => isEuropePop(code, pop.desc ?? "", pop.geo))
      .map(([code, pop]) => ({
        code,
        desc: pop.desc ?? code,
        relays: pop.relays?.length ?? 0,
      }))
      .sort((a, b) => a.desc.localeCompare(b.desc));

    const withRelays = europe.filter((pop) => pop.relays > 0);
    const silent = europe.filter((pop) => pop.relays === 0);
    const playerCount = players.value.response?.player_count;
    let health: Health = "operational";
    if (!sdr.value.success || europe.length === 0) health = "outage";
    else if (withRelays.length < Math.max(3, Math.floor(europe.length * 0.4))) health = "degraded";

    const components: ComponentHealth[] = withRelays.map((pop) => ({
      name: pop.desc,
      health: "operational" as Health,
      detail: `${pop.relays} relay${pop.relays === 1 ? "" : "s"}`,
    }));
    if (silent.length) {
      components.push({
        name: "Unpublished pops",
        health: "operational",
        detail: silent.map((pop) => pop.code.toUpperCase()).join(", "),
      });
    }

    const summary =
      health === "operational"
        ? `${withRelays.length}/${europe.length} EU datagram pops publishing relays${
            typeof playerCount === "number" ? ` · ${playerCount.toLocaleString("en-US")} playing CS2` : ""
          }.`
        : "Europe CS2 datagram coverage looks thin or unavailable.";

    return {
      ...base("cs2-europe", new Date().toISOString(), ms),
      health,
      summary,
      components,
      incidents: [],
      meta: {
        euPops: europe.length,
        euWithRelays: withRelays.length,
        players: playerCount ?? 0,
      },
    };
  } catch (error) {
    return failed("cs2-europe", started, error);
  }
}

async function collectEpic(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<StatuspageSummary>("https://status.epicgames.com/api/v2/summary.json"),
    );
    return fromStatuspage("epic", value, ms, (name) => !/fortnite/i.test(name));
  } catch (error) {
    return failed("epic", started, error);
  }
}

async function collectFortnite(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<StatuspageSummary>("https://status.epicgames.com/api/v2/summary.json"),
    );
    return fromStatuspage("fortnite", value, ms, (name) => /fortnite/i.test(name));
  } catch (error) {
    return failed("fortnite", started, error);
  }
}

async function collectSpotify(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<StatuspageSummary>("https://spotify.statuspage.io/api/v2/summary.json"),
    );
    return fromStatuspage("spotify", value, ms);
  } catch (error) {
    return failed("spotify", started, error);
  }
}

function appleEventHealth(event: {
  eventStatus?: string;
  statusType?: string;
}): Health {
  const status = (event.eventStatus ?? "").toLowerCase();
  const type = (event.statusType ?? "").toLowerCase();
  if (status === "resolved" || status === "completed") return "operational";
  if (status !== "ongoing" && status !== "current" && status !== "upcoming") return "operational";
  if (type === "outage") return "outage";
  if (type === "maintenance") return "maintenance";
  return "degraded";
}

async function collectApple(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<AppleStatus>("https://www.apple.com/support/systemstatus/data/system_status_en_US.js"),
    );
    let health: Health = "operational";
    const incidents: Incident[] = [];
    const components: ComponentHealth[] = [];
    for (const service of value.services ?? []) {
      const active = (service.events ?? []).filter((event) => {
        const itemHealth = appleEventHealth(event);
        return itemHealth !== "operational";
      });
      if (!active.length) continue;
      for (const event of active) {
        const itemHealth = appleEventHealth(event);
        health = worseHealth(health, itemHealth);
        components.push({ name: service.serviceName, health: itemHealth, detail: event.message });
        incidents.push({
          id: `${service.serviceName}-${event.epochStartDate ?? event.datePosted ?? event.message}`,
          title: `${service.serviceName}: ${event.message ?? event.statusType ?? "Issue"}`,
          health: itemHealth,
          startedAt: event.epochStartDate ? new Date(event.epochStartDate).toISOString() : undefined,
          url: "https://www.apple.com/support/systemstatus/",
        });
      }
    }
    return {
      ...base("apple", new Date().toISOString(), ms),
      health,
      summary: overallSummary(health, incidents.length, incidents[0]?.title),
      components: components.slice(0, 10),
      incidents,
      meta: { services: value.services?.length ?? 0 },
    };
  } catch (error) {
    return failed("apple", started, error);
  }
}

async function collectAndroid(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<GoogleIncident[]>("https://status.play.google.com/incidents.json"),
    );
    const parsed = googleIncidents(value, "https://status.play.google.com");
    return {
      ...base("android", new Date().toISOString(), ms),
      health: parsed.health,
      summary: overallSummary(parsed.health, parsed.incidents.length, parsed.incidents[0]?.title),
      components: parsed.components.slice(0, 8),
      incidents: parsed.incidents,
    };
  } catch (error) {
    return failed("android", started, error);
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string): Array<{ title: string; description: string; pubDate?: string; link?: string }> {
  const items: Array<{ title: string; description: string; pubDate?: string; link?: string }> = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks) {
    const chunk = block.split(/<\/item>/i)[0] ?? "";
    const title = (chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const description = (chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .trim();
    const pubDate = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    const link = chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    items.push({ title, description, pubDate, link });
  }
  return items;
}

export function grokItemHealth(description: string): Health {
  const text = stripHtml(description).toLowerCase();
  if (text.includes("status: resolved") || text.includes("severity: available")) return "operational";
  // `\bmajor\b` so "majority of requests" is not read as a major outage.
  if (text.includes("outage") || /\bmajor\b/.test(text)) return "outage";
  if (text.includes("maintenance")) return "maintenance";
  return "degraded";
}

// status.x.ai serves its whole incident history in one feed, so an item is
// only evidence about right now if it is recent. An item with no parseable
// pubDate cannot be shown to be current; AWS drops undated events the same way.
export function grokItemActive(
  item: { description: string; pubDate?: string },
  now: number,
): boolean {
  if (grokItemHealth(item.description) === "operational") return false;
  const at = item.pubDate ? Date.parse(item.pubDate) : Number.NaN;
  return Number.isFinite(at) && now - at <= STALE_MS;
}

async function collectGrok(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() => fetchText("https://status.x.ai/feed.xml"));
    const items = parseRssItems(value.body);
    // parseRssItems only understands RSS 2.0 <item>. If x.ai moves to Atom
    // the parse yields nothing, and reporting that as "operational" would be
    // a confident all-clear built on no data. Unknown is the honest answer.
    if (items.length === 0) throw new SourceError("Grok feed returned no readable items.");
    const now = Date.now();
    const active = items.filter((item) => grokItemActive(item, now));
    let health: Health = "operational";
    const incidents: Incident[] = active.slice(0, 8).map((item, index) => {
      const itemHealth = grokItemHealth(item.description);
      health = worseHealth(health, itemHealth);
      return {
        id: item.link ?? `${item.title}-${index}`,
        title: item.title,
        health: itemHealth,
        startedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        url: item.link ?? "https://status.x.ai/",
      };
    });
    return {
      ...base("grok", new Date().toISOString(), ms),
      health,
      summary: overallSummary(health, incidents.length, incidents[0]?.title),
      components: [],
      incidents,
    };
  } catch (error) {
    return failed("grok", started, error);
  }
}

async function collectChatGpt(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<StatuspageSummary>("https://status.openai.com/api/v2/summary.json"),
    );
    return fromStatuspage("chatgpt", value, ms);
  } catch (error) {
    return failed("chatgpt", started, error);
  }
}

async function collectClaude(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() =>
      fetchJson<StatuspageSummary>("https://status.claude.com/api/v2/summary.json"),
    );
    return fromStatuspage("claude", value, ms);
  } catch (error) {
    return failed("claude", started, error);
  }
}

async function collectMikrotik(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(async () => {
      const channels = (
        await Promise.all(
          MIKROTIK_CHANNELS.map(async (channel) => {
            try {
              const { body } = await fetchText(`https://upgrade.mikrotik.com/routeros/${channel.file}`);
              const parsed = parseMikrotikNewest(body);
              if (!parsed) return null;
              return { ...channel, ...parsed };
            } catch {
              return null;
            }
          }),
        )
      ).filter((channel): channel is NonNullable<typeof channel> => Boolean(channel));
      if (!channels.length) throw new SourceError("MikroTik version channels did not respond.");
      const stable = channels.find((channel) => channel.file === "NEWESTa7.stable");
      const newest = channels.reduce((current, channel) => {
        const currentTime = Date.parse(current.releasedAt ?? "") || 0;
        const nextTime = Date.parse(channel.releasedAt ?? "") || 0;
        return nextTime > currentTime ? channel : current;
      }, channels[0]);
      let notes = "";
      const notesVersion = newest?.version ?? stable?.version;
      if (notesVersion) {
        try {
          const changelog = await fetchText(`https://download.mikrotik.com/routeros/${notesVersion}/CHANGELOG`);
          notes = summarizeMikrotikChangelog(changelog.body);
        } catch {
          notes = "";
        }
      }
      return { channels, notes, stable, newest };
    });

    const components: ComponentHealth[] = value.channels.map((channel) => ({
      name: channel.name,
      health: isFreshRelease(channel.releasedAt) ? "maintenance" : "operational",
      detail: [channel.version, formatReleaseAge(channel.releasedAt)].filter(Boolean).join(" · "),
    }));

    const latest = value.stable?.version ?? value.newest?.version ?? value.channels[0]?.version ?? "";
    const latestDate = formatReleaseAge(value.newest?.releasedAt ?? value.stable?.releasedAt);
    const summary =
      value.notes ||
      (latest ? `Latest RouterOS ${latest}${latestDate ? ` · ${latestDate}` : ""}` : "RouterOS channels loaded.");

    return {
      ...base("mikrotik", new Date().toISOString(), ms),
      health: "operational",
      summary,
      components,
      incidents: [],
      meta: {
        latest,
        versions: formatVersionMap(value.channels.map((channel) => ({ name: channel.name, version: channel.version }))),
      },
    };
  } catch (error) {
    return failed("mikrotik", started, error);
  }
}

async function collectAppleOs(): Promise<ServiceSnapshot> {
  const started = Date.now();
  try {
    const { value, ms } = await timed(() => fetchText("https://developer.apple.com/news/releases/rss/releases.rss"));
    const items = parseRssItems(value.body);
    const latest = latestAppleOsByFamily(items);
    if (!latest.length) throw new SourceError("Apple OS release feed had no OS items.");

    const components: ComponentHealth[] = latest.map((release) => ({
      name: release.family,
      health: isFreshRelease(release.publishedAt) ? "maintenance" : "operational",
      detail: [release.version, formatReleaseAge(release.publishedAt)].filter(Boolean).join(" · "),
    }));

    const headline = [...latest].sort((a, b) => {
      const aTime = Date.parse(a.publishedAt ?? "") || 0;
      const bTime = Date.parse(b.publishedAt ?? "") || 0;
      return bTime - aTime;
    })[0];
    const summary = headline
      ? `Latest: ${headline.title}${headline.publishedAt ? ` · ${formatReleaseAge(headline.publishedAt)}` : ""}`
      : "Apple OS release feed loaded.";

    return {
      ...base("apple-os", new Date().toISOString(), ms),
      health: "operational",
      summary,
      components,
      incidents: [],
      meta: {
        latest: headline?.title ?? "",
        versions: formatVersionMap(latest.map((release) => ({ name: release.family, version: release.version }))),
      },
    };
  } catch (error) {
    return failed("apple-os", started, error);
  }
}

export async function collectAllServices(): Promise<ServiceSnapshot[]> {
  return Promise.all([
    collectGcp(),
    collectAws(),
    collectSteam(),
    collectCs2Europe(),
    collectEpic(),
    collectFortnite(),
    collectSpotify(),
    collectApple(),
    collectAndroid(),
    collectGrok(),
    collectChatGpt(),
    collectClaude(),
    collectMikrotik(),
    collectAppleOs(),
  ]);
}
