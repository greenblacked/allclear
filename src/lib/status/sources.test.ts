import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { awsEventActive, classifyFailure, grokItemActive, grokItemHealth, saysResolved } from "./sources.server.ts";
import { SourceError } from "./http.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);

describe("grok feed", () => {
  it("reads an explicit resolution as operational", () => {
    assert.equal(grokItemHealth("Status: Resolved - all good"), "operational");
    assert.equal(grokItemHealth("Severity: Available"), "operational");
  });

  it("does not read 'majority' as a major outage", () => {
    assert.equal(grokItemHealth("The majority of requests succeeded"), "degraded");
    assert.equal(grokItemHealth("Major service disruption"), "outage");
    assert.equal(grokItemHealth("Partial outage in one region"), "outage");
    assert.equal(grokItemHealth("Scheduled maintenance window"), "maintenance");
  });

  it("ignores an unresolved item older than the staleness window", () => {
    const stale = { description: "Investigating elevated errors", pubDate: new Date(NOW - 20 * DAY).toUTCString() };
    const fresh = { description: "Investigating elevated errors", pubDate: new Date(NOW - 2 * DAY).toUTCString() };
    assert.equal(grokItemActive(stale, NOW), false);
    assert.equal(grokItemActive(fresh, NOW), true);
  });

  it("ignores an item with no usable date", () => {
    assert.equal(grokItemActive({ description: "Investigating" }, NOW), false);
    assert.equal(grokItemActive({ description: "Investigating", pubDate: "not a date" }, NOW), false);
  });

  it("ignores a resolved item even when it is recent", () => {
    const item = { description: "Status: Resolved", pubDate: new Date(NOW - 60_000).toUTCString() };
    assert.equal(grokItemActive(item, NOW), false);
  });
});

describe("aws health events", () => {
  const recent = Math.floor((NOW - DAY) / 1000);

  it("treats an event with no status as inactive unless the log says otherwise", () => {
    assert.equal(
      awsEventActive({ event_log: [{ timestamp: recent, message: "Elevated error rates" }] } as never, NOW),
      true,
    );
    assert.equal(
      awsEventActive({ event_log: [{ timestamp: recent, message: "The issue is resolved" }] } as never, NOW),
      false,
    );
  });

  it("does not read a negated or prefixed 'resolved' as a resolution", () => {
    assert.equal(saysResolved("The issue is resolved"), true);
    assert.equal(saysResolved("Resolved: services recovered"), true);
    assert.equal(saysResolved("We have not yet resolved the elevated error rates"), false);
    assert.equal(saysResolved("The issue has not been resolved"), false);
    assert.equal(saysResolved("Issue remains unresolved"), false);
    assert.equal(
      awsEventActive({ event_log: [{ timestamp: recent, message: "We have not yet resolved the errors" }] } as never, NOW),
      true,
    );
  });

  it("honours a numeric status when one is present", () => {
    assert.equal(awsEventActive({ status: 1, event_log: [{ timestamp: recent, message: "Investigating" }] } as never, NOW), true);
    assert.equal(awsEventActive({ status: 0, event_log: [{ timestamp: recent, message: "resolved" }] } as never, NOW), false);
  });

  it("does not read a blank or null status as resolved", () => {
    // Number(null) and Number("") are both 0, which would look like a
    // vendor-reported resolution and drop a live event.
    for (const status of [null, "", undefined]) {
      assert.equal(
        awsEventActive({ status, event_log: [{ timestamp: recent, message: "Elevated error rates" }] } as never, NOW),
        true,
        `status ${JSON.stringify(status)} should fall back to the update text`,
      );
    }
  });

  it("ignores closed, stale, and pre-resolved events", () => {
    assert.equal(awsEventActive({ end_time: "2026-09-21", status: 1 } as never, NOW), false);
    assert.equal(awsEventActive({ summary: "[RESOLVED] Elevated errors", status: 1 } as never, NOW), false);
    assert.equal(
      awsEventActive({ status: 1, event_log: [{ timestamp: Math.floor((NOW - 30 * DAY) / 1000), message: "Investigating" }] } as never, NOW),
      false,
    );
  });
});

describe("collector failure classification", () => {
  it("separates transport failures from payload-shape failures", () => {
    assert.deepEqual(classifyFailure(new SourceError("403 Forbidden from https://x", 403)), {
      kind: "http",
      message: "403 Forbidden from https://x",
      status: 403,
    });
    assert.equal(classifyFailure(new SourceError("Timed out fetching https://x")).kind, "timeout");
    assert.equal(classifyFailure(new SourceError("getaddrinfo ENOTFOUND x")).kind, "network");
  });

  it("reports a vendor payload change as a parser failure with the real error", () => {
    let thrown: unknown;
    try {
      JSON.parse("<html>not json</html>");
    } catch (error) {
      thrown = error;
    }
    const failure = classifyFailure(thrown);
    assert.equal(failure.kind, "parser");
    assert.match(failure.message, /^SyntaxError: /);
    assert.equal(classifyFailure(new TypeError("Cannot read properties of undefined")).kind, "parser");
  });
});
