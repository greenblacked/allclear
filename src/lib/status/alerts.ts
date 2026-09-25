import type { PulseChange } from "./diff.ts";
import { healthLabel } from "./health.ts";

export type AlertMessage = { title: string; body: string; tag: string };

/**
 * The browser notification for one change between two boards. `tag` is the
 * service id, so a newer alert for the same service replaces the older one
 * instead of stacking.
 */
export function alertFor(change: PulseChange): AlertMessage {
  const title =
    change.from === change.to
      ? `${change.name}: new release`
      : change.to === "operational"
        ? `${change.name} recovered`
        : `${change.name}: ${healthLabel(change.to)}`;
  return { title, body: change.summary, tag: `status-bar:${change.id}` };
}
