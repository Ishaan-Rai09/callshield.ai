import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateRateLimit,
  hashRateLimitKey,
  MemoryWindowStore,
  rateWindow,
} from "../../src/lib/server/rateLimitCore";

test("hashes keys without exposing the original identifier", () => {
  const hash = hashRateLimitKey("tts:user-123");
  assert.match(hash, /^[a-f0-9]{32}$/);
  assert.equal(hash.includes("user-123"), false);
  assert.equal(hashRateLimitKey("tts:user-123"), hash);
  assert.notEqual(hashRateLimitKey("stt:user-123"), hash);
});

test("fixed windows align to the window start and reset at its end", () => {
  const window = rateWindow("stt:u1", 61_500, 60_000);
  assert.match(window.id, /^[a-f0-9]{32}:60000$/);
  assert.equal(window.resetAt, 120_000);

  const sameWindow = rateWindow("stt:u1", 119_999, 60_000);
  assert.equal(sameWindow.id, window.id);

  const nextWindow = rateWindow("stt:u1", 120_000, 60_000);
  assert.notEqual(nextWindow.id, window.id);
});

test("allows up to the limit and rejects the next request", () => {
  const resetAt = 60_000;
  assert.deepEqual(evaluateRateLimit(1, 2, resetAt, 30_000), {
    ok: true,
    retryAfterSec: 0,
    limit: 2,
    remaining: 1,
  });
  assert.deepEqual(evaluateRateLimit(2, 2, resetAt, 30_000), {
    ok: true,
    retryAfterSec: 0,
    limit: 2,
    remaining: 0,
  });
  const denied = evaluateRateLimit(3, 2, resetAt, 30_000);
  assert.equal(denied.ok, false);
  assert.equal(denied.retryAfterSec, 30);
});

test("reports unavailable when the shared store cannot be reached", () => {
  const result = evaluateRateLimit(0, 5, 60_000, 30_000, true);
  assert.equal(result.ok, false);
  assert.equal(result.unavailable, true);
});

test("memory fallback counts per window and resets", () => {
  const store = new MemoryWindowStore(10);
  const id = "window-a";
  assert.equal(store.increment(id, 1_000, 0), 1);
  assert.equal(store.increment(id, 1_000, 10), 2);
  assert.equal(store.increment(id, 1_000, 20), 3);
  // A new window starts a fresh counter.
  assert.equal(store.increment(id, 2_000, 1_100), 1);
});

test("memory fallback stays bounded under many live keys", () => {
  const store = new MemoryWindowStore(2);
  for (let i = 0; i < 10; i += 1) store.increment(`key-${i}`, 10_000, 10);
  assert.ok(store.size <= 2, `expected bounded size, got ${store.size}`);
});

test("concurrent increments never reuse a count", async () => {
  const store = new MemoryWindowStore(100);
  const counts = await Promise.all(
    Array.from({ length: 25 }, async () => store.increment("hot-key", 5_000, 1)),
  );
  assert.deepEqual(
    [...counts].sort((a, b) => a - b),
    Array.from({ length: 25 }, (_, i) => i + 1),
  );
});
