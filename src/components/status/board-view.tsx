import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiveBar } from "@/components/status/live-bar";
import { ServiceCard } from "@/components/status/service-card";
import { UpdateFeed } from "@/components/status/update-feed";
import { useNow } from "@/components/status/use-now";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStatusBoard, refreshStatusBoard } from "@/lib/status/board";
import { CATEGORIES } from "@/lib/status/catalog";
import { overallHealth } from "@/lib/status/diff";
import { healthLabel } from "@/lib/status/health";
import {
  emptyPulseStore,
  loadPulseStore,
  savePulseStore,
  syncPulse,
  type PulseStore,
} from "@/lib/status/pulse";
import { formatCountdown, lastPulseAt, LIVE_REFETCH_MS, nextPulseAt } from "@/lib/status/schedule";
import type { BoardSnapshot, CategoryId, Health } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ id: "all" | CategoryId; label: string }> = [
  { id: "all", label: "All" },
  ...CATEGORIES,
];


export function BoardView({ initial }: { initial: BoardSnapshot }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CategoryId>("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [store, setStore] = useState<PulseStore | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const manualRefreshInFlight = useRef(false);

  const boardQuery = useQuery({
    queryKey: ["status-board"],
    // The cached GET, not the forcing POST. With `refreshStatusBoard` here
    // every open tab forced its own full vendor sweep every two minutes, so
    // the 45s server cache never served anyone and load on the vendor APIs
    // scaled with the number of viewers. Forcing is for the Refresh button.
    queryFn: () => fetchStatusBoard(),
    initialData: initial,
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: LIVE_REFETCH_MS,
  });

  const board = boardQuery.data ?? initial;
  const overall = overallHealth(board);
  const pulseStore = store ?? emptyPulseStore();
  const changedIds = new Set(
    (pulseStore.pulses[0]?.opening ? [] : pulseStore.pulses[0]?.changes ?? []).map(
      (change) => change.id,
    ),
  );

  const remaining = now > 0 ? Math.max(0, nextPulseAt(now) - now) : 0;
  const slot = now > 0 ? lastPulseAt(now) : null;

  useEffect(() => {
    if (slot === null) return;
    const existing = store ?? loadPulseStore();
    const next = syncPulse(board, slot, existing);
    if (next !== existing) savePulseStore(next);
    if (store === null || next !== existing) setStore(next);
  }, [board, slot, store]);


  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return board.services.filter((service) => {
      if (category !== "all" && service.category !== category) return false;
      if (issuesOnly && service.health === "operational") return false;
      if (!needle) return true;
      const hay = `${service.name} ${service.shortName} ${service.summary} ${service.category}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [board.services, category, issuesOnly, query]);

  const issueCount =
    board.counts.degraded + board.counts.outage + board.counts.unknown + board.counts.maintenance;

  async function handleRefresh() {
    if (manualRefreshInFlight.current) return;
    manualRefreshInFlight.current = true;
    setRefreshing(true);
    try {
      const next = await refreshStatusBoard();
      queryClient.setQueryData(["status-board"], next);
    } catch {
      await boardQuery.refetch();
    } finally {
      manualRefreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  const fetching = boardQuery.isFetching || refreshing;

  return (
    <div className="liquid-stage text-fg">
      <div className="liquid-content">
      <header className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-4 sm:px-6 sm:pt-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
              <span className="live-dot inline-block size-1.5 rounded-full bg-ok" aria-hidden />
              Live status board
            </p>
            <h1 className="mt-2 font-display text-5xl font-medium tracking-[-0.04em] text-balance sm:text-6xl">
              Status Bar
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted text-pretty">
              Official sources are checked on a two-minute cadence; Refresh pulls a fresh check immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={fetching}
              aria-label="Refresh status now"
            >
              <RefreshCw className={cn("size-3.5", fetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OverallCard overall={overall} issueCount={issueCount} total={board.services.length} />
          <StatCard label="Operational" value={board.counts.operational} tone="operational" />
          <StatCard label="Attention" value={issueCount} tone={issueCount ? "degraded" : "operational"} />
          <StatCard
            label="Next update"
            value={now > 0 ? formatCountdown(remaining) : "—"}
            detail="Every 2 minutes"
          />
        </section>

        <LiveBar checkedAt={board.generatedAt} isFetching={fetching} now={now} />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search services</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GCP, CS2 Europe, RouterOS…"
              className="pl-10"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter services">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                variant={category === filter.id ? "default" : "outline"}
                size="sm"
                aria-pressed={category === filter.id}
                onClick={() => setCategory(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
            <Button
              variant={issuesOnly ? "solid" : "ghost"}
              size="sm"
              aria-pressed={issuesOnly}
              onClick={() => setIssuesOnly((value) => !value)}
            >
              Issues only
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {boardQuery.isError ? (
          <p className="mb-4 rounded-2xl glass px-4 py-3 text-sm text-down">
            Could not refresh official sources. Showing the last successful snapshot.
          </p>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            {fetching && !board.services.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-56" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="rounded-3xl glass px-5 py-10 text-center text-muted">
                No services match that filter.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visible.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                    emphasized={changedIds.has(service.id)}
                    mounted={now > 0}
                  />
                ))}
              </div>
            )}
          </div>
          <UpdateFeed pulses={pulseStore.pulses} />
        </div>

        <footer className="mt-14 flex flex-col gap-2 text-sm text-subtle">
          <p>
            Status Bar reads vendor status feeds only. It is not affiliated with Google, Amazon, Valve, Epic,
            Spotify, Apple, MikroTik, xAI, OpenAI, or Anthropic.
          </p>
          <p>Cached server snapshots update every two minutes from official vendor feeds.</p>
        </footer>
      </main>
      </div>
    </div>
  );
}

function OverallCard({
  overall,
  issueCount,
  total,
}: {
  overall: Health;
  issueCount: number;
  total: number;
}) {
  return (
    <div className="glass rounded-3xl p-4 sm:col-span-1">
      <div className="flex items-center gap-2 text-subtle">
        <Activity className="size-3.5" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Board</span>
      </div>
      <p className="mt-3 font-display text-2xl tracking-[-0.03em]">
        {overall === "operational" ? "All clear" : overall === "outage" ? "Outage" : "Attention"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Badge tone={overall}>{healthLabel(overall)}</Badge>
        <span className="font-mono text-[11px] tabular-nums text-subtle">
          {total - issueCount}/{total} clear
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number | string;
  tone?: Health;
  detail?: string;
}) {
  return (
    <div className="glass rounded-3xl p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
      <p className="mt-3 font-display text-2xl tabular-nums tracking-[-0.03em]">{value}</p>
      {tone ? (
        <p className="mt-2 font-mono text-[11px] text-subtle">{healthLabel(tone)}</p>
      ) : (
        <p className="mt-2 font-mono text-[11px] tabular-nums text-subtle">{detail}</p>
      )}
    </div>
  );
}
