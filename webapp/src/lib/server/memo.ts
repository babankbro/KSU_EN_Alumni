import "server-only";

/**
 * Short-lived, per-process cache for **aggregate** results only — counts and
 * statistics that name nobody, such as unfiltered directory facets or the
 * home-page figures. Never cache anything that depends on who is viewing or
 * that contains a person's details: those must always reflect the latest
 * privacy settings (NFR-PERF-03 load test showed these aggregates were the
 * bulk of database time at peak).
 */
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  // Share one in-flight load between concurrent requests; forget failures.
  const value = load().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { at: Date.now(), value });
  return value;
}
