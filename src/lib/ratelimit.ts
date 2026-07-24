/**
 * Tiny in-process rate limiter with pruning, used to slow down abuse of the
 * public endpoints (login, booking form, reception chat).
 *
 * Deliberately in-memory: the app runs as a single long-lived container. If it
 * is ever scaled horizontally this must move to Redis/Postgres — the limits
 * below would then apply per instance.
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

function prune(now: number, windowMs: number) {
  // Amortized cleanup so the map cannot grow without bound.
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

/**
 * Records an attempt for `key` and reports whether it is allowed.
 * @param limit  max attempts inside the window
 * @param windowMs  sliding window length
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  bucket.hits.push(now);
  buckets.set(key, bucket);

  if (bucket.hits.length > limit) {
    const oldest = bucket.hits[0];
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Clears a key after a successful action (e.g. correct password). */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}

/** Best-effort client IP from proxy headers (nginx sets X-Real-IP / X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
