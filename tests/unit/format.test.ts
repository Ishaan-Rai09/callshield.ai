import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClock, formatDuration, initials, relativeTime } from "../../src/lib/format";

test("formats call clocks as zero-padded minutes and seconds", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatClock(-5), "00:00");
  assert.equal(formatClock(59.9), "00:59");
});

test("formats durations in seconds and minutes", () => {
  assert.equal(formatDuration(0), "1s");
  assert.equal(formatDuration(42), "42s");
  assert.equal(formatDuration(60), "1m");
  assert.equal(formatDuration(125), "2m 5s");
});

test("derives initials while ignoring parenthesised notes", () => {
  assert.equal(initials("Ishaan Rai"), "IR");
  assert.equal(initials("Aarav (Northbridge)"), "A");
  assert.equal(initials("(Unknown) caller"), "C");
  assert.equal(initials(""), "");
});

test("describes recent timestamps in relative terms", () => {
  const fiveMinutesAgo = new Date(Date.now() - 5.2 * 60_000).toISOString();
  assert.equal(relativeTime(fiveMinutesAgo), "5 min ago");

  const twoHoursAgo = new Date(Date.now() - 2.2 * 3_600_000).toISOString();
  assert.equal(relativeTime(twoHoursAgo), "2h ago");
});
