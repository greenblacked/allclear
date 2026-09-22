export const LIVE_REFETCH_MS = 2 * 60 * 1000;
export const CACHE_TTL_MS = 45_000;
export const PULSE_INTERVAL_MS = 2 * 60 * 1000;
export const MAX_PULSES = 60;

export function lastPulseAt(now = Date.now()): number {
  return Math.floor(now / PULSE_INTERVAL_MS) * PULSE_INTERVAL_MS;
}

export function nextPulseAt(now = Date.now()): number {
  return lastPulseAt(now) + PULSE_INTERVAL_MS;
}

export function pulseProgress(now = Date.now()): number {
  const elapsed = now - lastPulseAt(now);
  return Math.min(1, Math.max(0, elapsed / PULSE_INTERVAL_MS));
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatSlotTime(slot: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(slot));
}
