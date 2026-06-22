import "server-only";

interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function evictExpired(now: number): void {
  for (const [key, state] of buckets) {
    if (now >= state.resetAt) buckets.delete(key);
  }
}

/**
 * Fixed-window in-memory rate limiter. Single-instance only (our deploy target
 * is a single Node server). Expired buckets are evicted when a new window opens,
 * bounding memory. For multi-instance scale, back this with a shared store
 * (e.g. Redis) — see the Auth/Dashboard plan.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    evictExpired(now);
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Test helper: clears all rate-limit state. */
export function _resetRateLimitStore(): void {
  buckets.clear();
}

/** Test helper: current number of tracked buckets. */
export function _rateLimitSize(): number {
  return buckets.size;
}
