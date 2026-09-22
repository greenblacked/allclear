import { ArrowUpRight, Cloud, Cpu, Gamepad2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { healthLabel } from "@/lib/status/health";
import type { CategoryId, Health, ServiceSnapshot } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<CategoryId, typeof Cloud> = {
  cloud: Cloud,
  gaming: Gamepad2,
  platforms: Smartphone,
  ai: Cpu,
};

function formatTime(iso?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  }).format(date);
}

export function ServiceCard({ service, index }: { service: ServiceSnapshot; index: number }) {
  const Icon = CATEGORY_ICON[service.category];
  const issueComponents = service.components.filter((component) => component.health !== "operational");
  const shown =
    issueComponents.length > 0
      ? issueComponents
      : service.id === "cs2-europe"
        ? service.components.slice(0, 6)
        : [];

  return (
    <article
      className="group relative flex flex-col rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] hover:shadow-[var(--shadow-border-hover)] stagger-in"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-10 place-items-center rounded-2xl bg-surface-2 text-muted",
              service.health === "outage" && "text-down",
              service.health === "degraded" && "text-warn",
              service.health === "operational" && "text-ok",
            )}
            aria-hidden
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-medium leading-tight tracking-[-0.03em] text-balance">
              {service.name}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-subtle">
              {service.shortName}
            </p>
          </div>
        </div>
        <HealthDot health={service.health} />
      </div>

      <p className="mt-4 min-h-10 text-sm leading-relaxed text-muted text-pretty">{service.summary}</p>

      {shown.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {shown.slice(0, 6).map((component, index) => (
            <li
              key={`${component.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3 py-2"
            >
              <span className="truncate text-sm text-fg">{component.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums text-subtle">
                {component.detail}
                <Badge tone={component.health}>{healthLabel(component.health)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {service.incidents.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {service.incidents.slice(0, 2).map((incident, incidentIndex) => (
            <li key={`${incident.id}-${incidentIndex}`} className="text-sm text-fg">
              <span className="text-down">{healthLabel(incident.health)}</span>
              <span className="text-subtle"> · </span>
              {incident.title}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="font-mono text-[11px] tabular-nums text-subtle">
          {service.latencyMs}ms
          {formatTime(service.checkedAt) ? ` · ${formatTime(service.checkedAt)}` : ""}
        </p>
        <a
          href={service.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        >
          {service.sourceName}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </article>
  );
}

function HealthDot({ health }: { health: Health }) {
  return (
    <Badge tone={health} className="gap-1.5 pr-2.5 pl-2">
      <span
        className={cn(
          "size-1.5 rounded-full",
          health === "operational" && "bg-ok",
          health === "degraded" && "bg-warn",
          health === "outage" && "bg-down animate-pulse",
          health === "maintenance" && "bg-accent",
          health === "unknown" && "bg-subtle",
        )}
      />
      {healthLabel(health)}
    </Badge>
  );
}
