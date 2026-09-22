import { Radio } from "lucide-react";
import { formatAge, formatCountdown, nextPulseAt, pulseProgress } from "@/lib/status/schedule";
import { cn } from "@/lib/utils";

export function LiveBar({
  checkedAt,
  isFetching,
  now,
}: {
  checkedAt: string;
  isFetching: boolean;
  now: number;
}) {
  const mounted = now > 0;
  const remaining = mounted ? Math.max(0, nextPulseAt(now) - now) : 0;
  const progress = mounted ? pulseProgress(now) : 0;
  const age = mounted ? formatAge(now - new Date(checkedAt).getTime()) : "…";

  return (
    <section className="glass rounded-3xl px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full glass-inset text-ok",
              isFetching && "text-muted",
            )}
            aria-hidden
          >
            <Radio className={cn("size-3.5", !isFetching && "live-dot")} />
          </span>
          <div>
            {/*
              The live region is scoped to this line alone. On the <section> it
              also covered the age and the countdown, both of which tick every
              second, so a screen reader re-announced the whole bar every second.
            */}
            <p className="font-medium tracking-[-0.02em]" aria-live="polite">
              {isFetching ? "Checking official sources" : "Live"}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-subtle">Last check {age}</p>
          </div>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          Next 2-min update
          <span className="ml-2 text-sm tabular-nums tracking-normal text-fg">
            {mounted ? formatCountdown(remaining) : "—"}
          </span>
        </p>
      </div>
      <div className="mt-3 h-0.5 overflow-hidden rounded-full glass-inset">
        <div
          className="h-full origin-left bg-accent/70 transition-transform duration-1000 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </section>
  );
}
