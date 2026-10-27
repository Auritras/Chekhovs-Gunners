export interface Limiter {
  check(key: string): boolean;
  /** Ms until the oldest request in the window expires (0 if none). */
  retryAfterMs(key: string): number;
}

/** Best-effort in-memory sliding-window limiter (per server instance). */
export function createLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): Limiter {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function prune(key: string): number[] {
    const cutoff = now() - opts.windowMs;
    const live = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
    return live;
  }

  return {
    check(key) {
      const live = prune(key);
      if (live.length >= opts.limit) return false;
      live.push(now());
      hits.set(key, live);
      return true;
    },
    retryAfterMs(key) {
      const live = prune(key);
      return live.length ? Math.max(0, live[0] + opts.windowMs - now()) : 0;
    },
  };
}
