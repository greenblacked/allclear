import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  it("returns a cached value until its TTL expires", async () => {
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const cache = createTtlCache(load, 45_000);

    await expect(cache.get()).resolves.toBe("first");
    await expect(cache.get()).resolves.toBe("first");

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("deduplicates overlapping cached and forced refreshes", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const cache = createTtlCache(load, 45_000);

    const first = cache.get();
    const forced = cache.get({ force: true });
    resolve("board");

    await expect(Promise.all([first, forced])).resolves.toEqual(["board", "board"]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
