import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  formatAge,
  formatCountdown,
  lastPulseAt,
  nextPulseAt,
  PULSE_INTERVAL_MS,
  pulseProgress,
} from "./schedule.ts";

describe("pulse schedule", () => {
  it("aligns slots to 2-minute walls", () => {
    const noon = Date.parse("2026-09-22T12:00:00.000Z");
    const twelveOhOne = noon + 60 * 1000;
    assert.equal(lastPulseAt(twelveOhOne), noon);
    assert.equal(nextPulseAt(twelveOhOne), noon + PULSE_INTERVAL_MS);
    assert.equal(nextPulseAt(noon), noon + PULSE_INTERVAL_MS);
    assert.equal(lastPulseAt(noon + 3 * 60 * 1000), noon + PULSE_INTERVAL_MS);
  });

  it("tracks progress through the current slot", () => {
    const noon = Date.parse("2026-09-22T12:00:00.000Z");
    assert.equal(pulseProgress(noon), 0);
    assert.equal(pulseProgress(noon + PULSE_INTERVAL_MS / 2), 0.5);
  });

  it("formats countdown and relative age", () => {
    assert.equal(formatCountdown(4 * 60 * 1000 + 2_000), "4:02");
    assert.equal(formatCountdown(500), "0:01");
    assert.equal(formatAge(4_000), "just now");
    assert.equal(formatAge(23_000), "23s ago");
    assert.equal(formatAge(3 * 60 * 1000), "3m ago");
  });
});
