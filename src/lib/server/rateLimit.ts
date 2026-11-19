import { collections } from "@/lib/server/db";
import {
  evaluateRateLimit,
  MemoryWindowStore,
  rateWindow,
  type RateLimitResult,
} from "@/lib/server/rateLimitCore";

/**
 * Fixed-window rate limiting shared across serverless instances.
 *
 * Backend order:
 *   1. MongoDB (already required for account data) — atomic `$inc` per hashed
 *      key and window. A TTL index reaps old windows.
 *   2. In-memory map, development only.
 *
 * In production, if MongoDB is missing or the limiter write fails, the request
 * is refused (`unavailable`) instead of silently running unlimited. Keys are
 * hashed, so user ids never appear in the limiter collection or logs.
 */

const WINDOW_GRACE_MS = 60_000;
const memory = new MemoryWindowStore();

async function mongoIncrement(id: string, expiresAt: number): Promise<number> {
  const limits = await collections.rateLimits;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const doc = await limits.findOneAndUpdate(
        { _id: id },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date(expiresAt) },
        },
        { upsert: true, returnDocument: "after" }
      );
      return doc?.count ?? 1;
    } catch (error) {
      // Two concurrent first requests can race the upsert's unique _id.
      const duplicate =
        error instanceof Error && (error as { code?: number }).code === 11000;
      if (!duplicate || attempt === 1) throw error;
    }
  }
  throw new Error("rate limit increment failed");
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const window = rateWindow(key, now, windowMs);
  const isProduction = process.env.NODE_ENV === "production";
  const sharedConfigured = Boolean(process.env.MONGODB_URI?.trim());

  if (sharedConfigured) {
    try {
      const count = await mongoIncrement(window.id, window.resetAt + WINDOW_GRACE_MS);
      return evaluateRateLimit(count, limit, window.resetAt, now);
    } catch {
      // Never echo the key or Mongo error: it can contain connection details.
      console.warn("[rate-limit] shared counter unavailable");
      if (isProduction) {
        return evaluateRateLimit(0, limit, window.resetAt, now, true);
      }
    }
  } else if (isProduction) {
    console.warn("[rate-limit] MONGODB_URI missing; refusing billable requests");
    return evaluateRateLimit(0, limit, window.resetAt, now, true);
  }

  const count = memory.increment(window.id, window.resetAt, now);
  return evaluateRateLimit(count, limit, window.resetAt, now);
}
