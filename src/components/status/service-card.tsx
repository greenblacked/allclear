import { ArrowUpRight, Cloud, Cpu, Gamepad2, History, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { healthLabel } from "@/lib/status/health";
import type { CategoryId, Health, ServiceSnapshot } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<CategoryId, typeof Cloud> = {
  cloud: Cloud,
  gaming: Gamepad2,
  platforms: Smartphone,
  ai: Cpu,
  updates: History,
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

export function ServiceCard({
  service,
  index,
  emphasized = false,
  mounted = false,
}: {
  service: ServiceSnapshot;
  index: number;
  emphasized?: boolean;
  /** False until the client has mounted; see checkedAt below. */
  mounted?: boolean;
}) {
  const Icon = CATEGORY_ICON[service.category];
  const checkedAtLabel = formatTime(service.checkedAt);
  const changelog = service.category === "updates";
  const issueComponents = service.components.filter((component) => component.health !== "operational");
  const shown =
    changelog || service.id === "cs2-europe"
      ? service.components.slice(0, 6)
      : issueComponents.length > 0
        ? issueComponents
        : [];

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-3xl glass p-4 transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] hover:shadow-[var(--shadow-border-hover)] stagger-in",
        emphasized && (service.health === "outage" ? "service-card-changed is-down" : "service-card-changed"),
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-10 place-items-center rounded-2xl glass-inset text-muted",
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
              {emphasized ? " · changed" : ""}
            </p>
          </div>
        </div>
        <HealthDot health={service.health} />
      </div>

      <p className="mt-4 min-h-10 text-sm leading-relaxed text-muted text-pretty [overflow-wrap:anywhere]">{service.summary}</p>

      {shown.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {shown.slice(0, 6).map((component, componentIndex) => (
            <li
              key={`${component.name}-${componentIndex}`}
              className="flex items-center justify-between gap-3 rounded-xl glass-inset px-3 py-2"
            >
              <span className="truncate text-sm text-fg">{component.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums text-subtle">
                {component.detail}
                {changelog ? (
                  component.health === "maintenance" ? (
                    <Badge tone="maintenance">New</Badge>
                  ) : null
                ) : (
                  <Badge tone={component.health}>{healthLabel(component.health)}</Badge>
                )}
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
          {/*
            `checkedAt` is formatted in the viewer's timezone, so the server
            ("12:04 UTC") and the client ("14:04 GMT+2") disagree and hydration
            mismatches. Render it only after mount, as LiveBar does.
          */}
          {mounted && checkedAtLabel ? ` · ${checkedAtLabel}` : ""}
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
