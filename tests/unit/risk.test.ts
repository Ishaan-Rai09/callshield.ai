import assert from "node:assert/strict";
import { test } from "node:test";
import { assessRisk, INDICATOR_CATALOG, toIndicators } from "../../src/lib/risk";

test("deduplicates indicator keys before building the catalog entries", () => {
  const indicators = toIndicators(["otp_request", "otp_request", "pressure_tactics"]);
  assert.equal(indicators.length, 2);
  assert.equal(indicators[0]?.label, INDICATOR_CATALOG.otp_request.label);
});

test("treats a call with no signals as low risk", () => {
  const assessment = assessRisk([]);
  assert.equal(assessment.score, 0);
  assert.equal(assessment.level, "low");
  assert.equal(assessment.label, "Low Risk");
});

test("raises low-severity-only signals to needs attention", () => {
  const assessment = assessRisk(["vague_identity", "pressure_tactics"]);
  assert.equal(assessment.score, 2);
  assert.equal(assessment.level, "attention");
});

test("flags multiple high-severity requests as high risk", () => {
  const assessment = assessRisk(["otp_request", "remote_access"]);
  assert.equal(assessment.score, 6);
  assert.equal(assessment.level, "high");
  assert.match(assessment.rationale, /2 suspicious signals/);
});

test("does not call a single critical signal high risk on its own", () => {
  const assessment = assessRisk(["otp_request"]);
  assert.equal(assessment.score, 3);
  assert.equal(assessment.level, "attention");
});
