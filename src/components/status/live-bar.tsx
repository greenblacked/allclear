import { Radio } from "lucide-react";
import { formatAge, formatCountdown, nextPulseAt, pulseProgress } from "@/lib/status/schedule";
import { cn } from "@/lib/utils";

/** The freshness strip at the foot of the summary panel. */
export function LiveBar({
  checkedAt,
  isFetching,
  now,
  className,
}: {
  checkedAt: string;
  isFetching: boolean;
  now: number;
  className?: string;
}) {
  const mounted = now > 0;
  const remaining = mounted ? Math.max(0, nextPulseAt(now) - now) : 0;
  const progress = mounted ? pulseProgress(now) : 0;
  const age = mounted ? formatAge(now - new Date(checkedAt).getTime()) : "…";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-subtle">
        <p className="flex items-center gap-2">
          <Radio className={cn("size-3.5", isFetching ? "text-muted" : "live-dot text-ok")} aria-hidden />
          {/*
            The live region is scoped to this word alone. The age and the
            countdown tick every second, and a wider region made a screen
            reader re-announce them every second.
          */}
          <span className="text-fg" aria-live="polite">
            {isFetching ? "Checking official sources" : "Live"}
          </span>
          <span>· last check {age}</span>
        </p>
        <p>
          Next update <span className="text-fg">{mounted ? formatCountdown(remaining) : "—"}</span>
        </p>
      </div>
      <div className="mt-2 h-0.5 overflow-hidden rounded-full glass-inset">
        <div
          className="h-full origin-left bg-accent/70 transition-transform duration-1000 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
