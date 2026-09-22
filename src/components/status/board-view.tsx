import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ServiceCard } from "@/components/status/service-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStatusBoard } from "@/lib/status/board";
import { CATEGORIES } from "@/lib/status/catalog";
import { healthLabel, worseHealth } from "@/lib/status/health";
import type { BoardSnapshot, CategoryId, Health } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ id: "all" | CategoryId; label: string }> = [
  { id: "all", label: "All" },
  ...CATEGORIES,
];

export function BoardView({ initial }: { initial: BoardSnapshot }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CategoryId>("all");
  const [issuesOnly, setIssuesOnly] = useState(false);

  const boardQuery = useQuery({
    queryKey: ["status-board"],
    queryFn: () => fetchStatusBoard(),
    initialData: initial,
    refetchInterval: 60_000,
  });

  const board = boardQuery.data ?? initial;
  const overall = board.services.reduce((acc, service) => worseHealth(acc, service.health), "operational" as Health);

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

  const issueCount = board.counts.degraded + board.counts.outage + board.counts.unknown + board.counts.maintenance;
  const checked = new Date(board.generatedAt);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(197,205,216,0.06),transparent)]" />
      <header className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-4 sm:px-6 sm:pt-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">Centralized status board</p>
            <h1 className="mt-2 font-display text-5xl font-medium tracking-[-0.04em] text-balance sm:text-6xl">
              AllClear
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted text-pretty">
              Live health for cloud, games, platforms, and AI — pulled from official status pages, not rumor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => boardQuery.refetch()}
              disabled={boardQuery.isFetching}
              aria-label="Refresh status"
            >
              <RefreshCw className={cn("size-3.5", boardQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-4">
          <OverallCard overall={overall} issueCount={issueCount} total={board.services.length} />
          <StatCard label="Operational" value={board.counts.operational} tone="operational" />
          <StatCard label="Attention" value={issueCount} tone={issueCount ? "degraded" : "operational"} />
          <StatCard
            label="Collected"
            value={`${Math.round(board.durationMs / 100) / 10}s`}
            detail={checked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          />
        </section>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search services</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GCP, CS2 Europe, Claude…"
              className="pl-10"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <Button
                key={filter.id}
                variant={category === filter.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
            <Button
              variant={issuesOnly ? "solid" : "ghost"}
              size="sm"
              onClick={() => setIssuesOnly((value) => !value)}
            >
              Issues only
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {boardQuery.isError ? (
          <p className="rounded-2xl bg-down/10 px-4 py-3 text-sm text-down">
            Could not refresh official sources. Showing the last successful snapshot.
          </p>
        ) : null}

        {boardQuery.isFetching && !board.services.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-3xl bg-surface px-5 py-10 text-center text-muted shadow-[var(--shadow-border)]">
            No services match that filter.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} />
            ))}
          </div>
        )}

        <footer className="mt-14 flex flex-col gap-2 text-sm text-subtle">
          <p>
            AllClear reads vendor status feeds only. It is not affiliated with Google, Amazon, Valve, Epic, Spotify,
            Apple, xAI, OpenAI, or Anthropic.
          </p>
          <p>Snapshots cache for 45 seconds. Auto-refresh every minute.</p>
        </footer>
      </main>
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
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] sm:col-span-1">
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
    <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
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
