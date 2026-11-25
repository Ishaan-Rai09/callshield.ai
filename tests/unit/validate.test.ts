import assert from "node:assert/strict";
import { test } from "node:test";
import { digitsOf, sanitizeBlockedNumber, sanitizeCallRecord } from "../../src/lib/server/validate";

const record = {
  id: "call-1",
  scenarioId: "bank",
  number: "+91 98765 43210",
  callerName: "Test Caller",
  claimedOrg: "Test Bank",
  startedAt: "2026-01-01T00:00:00.000Z",
  durationSec: 30,
  riskLevel: "high",
  intent: "Collect an OTP",
  summary: "Suspicious call",
  action: "blocked",
  transcript: [
    { id: "line-1", speaker: "caller", text: "Give me the code", at: 1 },
    { id: "bad id!", speaker: "caller", text: "dropped", at: 2 },
  ],
  indicators: [],
  infoRequested: ["OTP"],
  identityConfidence: 10,
  events: [],
  liveScreened: true,
  hacked: "<script>alert(1)</script>",
};

test("sanitizes a valid call and strips unknown fields", () => {
  const clean = sanitizeCallRecord(record);
  assert.ok(clean);
  assert.equal(clean.id, "call-1");
  assert.equal(clean.transcript.length, 1);
  assert.equal("hacked" in clean, false);
});

test("rejects malformed identifiers and too-short numbers", () => {
  assert.equal(sanitizeCallRecord({ ...record, id: "../passwd" }), null);
  assert.equal(sanitizeCallRecord({ ...record, number: "12" }), null);
  assert.equal(sanitizeCallRecord({ ...record, startedAt: "not-a-date" }), null);
});

test("clamps numeric fields and bounds list sizes", () => {
  const clean = sanitizeCallRecord({
    ...record,
    durationSec: 10_000_000,
    identityConfidence: 900,
    infoRequested: Array.from({ length: 100 }, (_, i) => `item-${i}`),
    transcript: Array.from({ length: 500 }, (_, i) => ({
      id: `line-${i}`,
      speaker: "caller",
      text: "hi",
      at: i,
    })),
  });
  assert.ok(clean);
  assert.equal(clean.durationSec, 86_400);
  assert.equal(clean.identityConfidence, 100);
  assert.equal(clean.infoRequested.length, 40);
  assert.equal(clean.transcript.length, 300);
});

test("normalizes digits for phone comparisons", () => {
  assert.equal(digitsOf("+91 (98765) 43210"), "919876543210");
});

test("validates blocked numbers and defaults source to manual", () => {
  const entry = sanitizeBlockedNumber({
    id: "blk-1",
    number: "+91 90000 00000",
    label: "Spam",
    reason: "Repeated calls",
    blockedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(entry);
  assert.equal(entry.source, "manual");
  assert.equal(entry.label, "Spam");

  assert.equal(sanitizeBlockedNumber({ id: "blk-1", number: "1" }), null);
});
