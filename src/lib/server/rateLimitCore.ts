import { createHash } from "node:crypto";

/**
 * Pure fixed-window primitives shared by the MongoDB and memory limiters.
 * Kept dependency-free so they can be unit-tested without Next.js.
 */

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  limit: number;
  remaining: number;
  /** Shared limiting could not be enforced; callers should fail safely. */
  unavailable?: boolean;
}

export interface RateWindow {
  /** Opaque, hashed identifier — no user id is ever stored raw. */
  id: string;
  /** Unix ms at which the window resets. */
  resetAt: number;
}

/** Hash before storage/logging so rate-limit keys cannot leak user ids. */
export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function rateWindow(key: string, now: number, windowMs: number): RateWindow {
  const start = Math.floor(now / windowMs) * windowMs;
  return {
    id: `${hashRateLimitKey(key)}:${start}`,
    resetAt: start + windowMs,
  };
}

export function evaluateRateLimit(
  count: number,
  limit: number,
  resetAt: number,
  now: number,
  unavailable = false
): RateLimitResult {
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
  if (unavailable) {
    return { ok: false, retryAfterSec, limit, remaining: 0, unavailable: true };
  }
  if (count > limit) {
    return { ok: false, retryAfterSec, limit, remaining: 0 };
  }
  return { ok: true, retryAfterSec: 0, limit, remaining: Math.max(0, limit - count) };
}

/** Bounded in-memory fallback used for local development only. */
export class MemoryWindowStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxKeys = 5_000) {}

  get size(): number {
    return this.buckets.size;
  }

  increment(id: string, resetAt: number, now: number): number {
    this.sweep(now);
    const existing = this.buckets.get(id);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(id, { count: 1, resetAt });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  private sweep(now: number) {
    if (this.buckets.size < this.maxKeys) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    // Still full of live windows: drop the oldest insertion so memory is bounded.
    while (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}
