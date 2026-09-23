import { describe, expect, it } from "vitest";
import { attentionBreakdown } from "./health";

const none = { operational: 0, degraded: 0, outage: 0, maintenance: 0, unknown: 0 };

describe("attentionBreakdown", () => {
  it("names each state that needs attention, worst first", () => {
    expect(attentionBreakdown({ ...none, operational: 9, degraded: 2, outage: 1, unknown: 2 })).toBe(
      "1 outage · 2 degraded · 2 unknown",
    );
  });

  it("says Unknown when every item is Unknown, not Degraded", () => {
    expect(attentionBreakdown({ ...none, operational: 1, unknown: 13 })).toBe("13 unknown");
  });

  it("has nothing to list on an all-clear board", () => {
    expect(attentionBreakdown({ ...none, operational: 14 })).toBe("nothing to watch");
  });
});
