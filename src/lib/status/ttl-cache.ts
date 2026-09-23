export function createTtlCache<T>(load: () => Promise<T>, ttlMs: number) {
  let cached: { expires: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;

  async function get({ force = false }: { force?: boolean } = {}): Promise<T> {
    const now = Date.now();
    if (!force && cached && cached.expires > now) return cached.value;
    if (inflight) return inflight;

    inflight = load()
      .then((value) => {
        cached = { expires: Date.now() + ttlMs, value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });

    return inflight;
  }

  return { get };
}
