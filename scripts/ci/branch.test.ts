import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./branch.sh", import.meta.url));

function check(name: string): { ok: boolean; output: string } {
  const result = spawnSync(SCRIPT, [name], { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

describe("branch.sh", () => {
  it.each([
    "fb/board-metrics-stars-shortcuts",
    "fix/42-aws-stale-events",
    "chore/bump-tanstack-start",
    "docs/readme-integrations",
    "ci/cache-actionlint-image",
    "fb/a",
  ])("accepts %s", (name) => {
    expect(check(name).ok).toBe(true);
  });

  it.each(["dev", "dependabot/npm_and_yarn/vite-8.4.0", "release/v0.4.0"])(
    "accepts the long-lived or tool-named %s",
    (name) => {
      expect(check(name).ok).toBe(true);
    },
  );

  it.each([
    ["feat/board-metrics", "an unknown prefix"],
    ["feature/board-metrics", "an unknown prefix"],
    ["fix-aws", "no slash"],
    ["fb/Add-Gemini", "uppercase"],
    ["fb/add_gemini", "an underscore"],
    ["fb/add--gemini", "a double hyphen"],
    ["docs/readme-", "a trailing hyphen"],
    ["fb/", "an empty description"],
    ["fb/nested/path", "a second slash"],
    ["release/next", "a release branch without a version"],
    ["develop", "a long-lived name the repository does not use"],
    ["main", "main as a head branch, which would commit dev's work to main"],
  ])("rejects %s (%s)", (name) => {
    const result = check(name);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("CONTRIBUTING.md#branches");
  });

  it("rejects a name over 50 characters and says how long it is", () => {
    const name = `fb/${"a".repeat(48)}`;
    const result = check(name);
    expect(result.ok).toBe(false);
    expect(result.output).toContain(`${name.length} characters`);
  });

  it("accepts a name of exactly 50 characters", () => {
    expect(check(`fb/${"a".repeat(47)}`).ok).toBe(true);
  });
});
