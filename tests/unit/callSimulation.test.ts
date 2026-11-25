import assert from "node:assert/strict";
import { test } from "node:test";
import { callSimulationService } from "../../src/lib/services/callSimulationService";
import { DEFAULT_ASSISTANT } from "../../src/lib/seed";
import { getScenario } from "../../src/lib/scenarios";

function startedSession() {
  const scenario = getScenario("bank-impersonation");
  assert.ok(scenario);
  return { scenario, session: callSimulationService.createSession(scenario, DEFAULT_ASSISTANT) };
}

test("a new session starts ringing with no transcript or risk", () => {
  const { session } = startedSession();
  assert.equal(session.phase, "ringing");
  assert.equal(session.answeredByAI, false);
  assert.equal(session.transcript.length, 0);
  assert.equal(session.riskLevel, "low");
  assert.equal(session.outcome, null);
});

test("answering moves the session into AI screening with a greeting line", () => {
  const { session } = startedSession();
  const answered = callSimulationService.answer(session, DEFAULT_ASSISTANT);
  assert.equal(answered.phase, "screening");
  assert.equal(answered.answeredByAI, true);
  assert.ok(answered.transcript.length > 0);
  assert.equal(answered.transcript[0]?.speaker, "ai");
});

test("finalizing produces a call record with the chosen outcome", () => {
  const { scenario, session } = startedSession();
  const answered = callSimulationService.answer(session, DEFAULT_ASSISTANT);
  const record = callSimulationService.finalize(answered, scenario, "blocked");
  assert.equal(record.scenarioId, scenario.id);
  assert.equal(record.action, "blocked");
  assert.equal(record.number, scenario.number);
  assert.equal(record.liveScreened, true);
  assert.ok(record.events.length > session.events.length);
});
