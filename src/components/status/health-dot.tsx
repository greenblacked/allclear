import type { Health } from "@/lib/status/types";
import { cn } from "@/lib/utils";

const DOT: Record<Health, string> = {
  operational: "bg-ok",
  degraded: "bg-warn",
  outage: "bg-down",
  maintenance: "bg-accent",
  unknown: "bg-subtle",
};

/** A small status dot. Decorative: pair it with a text label. */
export function HealthDot({ health, className }: { health: Health; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[health], health === "outage" && "animate-pulse", className)}
    />
  );
}
