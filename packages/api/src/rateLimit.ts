import { RATE_LIMIT_LOCK_MS, RATE_LIMIT_MAX_FAILS, RATE_LIMIT_WINDOW_MS } from "@abholdemo/shared";

export interface RateLimiter {
  isLocked(key: string): boolean;
  recordFail(key: string): void;
}

/** In memory limiter: maxFails failures within windowMs lock the key for lockMs. Clock is injected. */
export function createRateLimiter(
  now: () => number,
  opts = { maxFails: RATE_LIMIT_MAX_FAILS, windowMs: RATE_LIMIT_WINDOW_MS, lockMs: RATE_LIMIT_LOCK_MS },
): RateLimiter {
  const entries = new Map<string, { fails: number[]; lockedUntil: number }>();
  return {
    isLocked(key) {
      const e = entries.get(key);
      return !!e && e.lockedUntil > now();
    },
    recordFail(key) {
      const t = now();
      const e = entries.get(key) ?? { fails: [], lockedUntil: 0 };
      e.fails = e.fails.filter((f) => f > t - opts.windowMs);
      e.fails.push(t);
      if (e.fails.length >= opts.maxFails) {
        e.lockedUntil = t + opts.lockMs;
        e.fails = [];
      }
      entries.set(key, e);
      // drop stale entries now and then so the map cannot grow without bound
      if (entries.size > 1000) {
        for (const [k, v] of entries) if (v.lockedUntil <= t && v.fails.every((f) => f <= t - opts.windowMs)) entries.delete(k);
      }
    },
  };
}
