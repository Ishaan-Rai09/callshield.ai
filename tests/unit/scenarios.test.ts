import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHinglish, getScenario, SCENARIOS } from "../../src/lib/scenarios";

test("every scenario has a unique id and a non-empty script", () => {
  const ids = new Set(SCENARIOS.map((scenario) => scenario.id));
  assert.equal(ids.size, SCENARIOS.length);
  for (const scenario of SCENARIOS) {
    assert.ok(scenario.script.length > 0, `${scenario.id} has no script`);
  }
});

test("looks scenarios up by id and returns undefined for unknown ids", () => {
  assert.equal(getScenario("not-a-scenario"), undefined);
  const scenario = getScenario(SCENARIOS[0]!.id);
  assert.equal(scenario?.id, SCENARIOS[0]!.id);
});

test("Hinglish flavouring replaces only scripted lines that have a variant", () => {
  const scenario = SCENARIOS.find((item) => item.script.some((step) => step.hinglish));
  assert.ok(scenario, "expected at least one Hinglish scenario");

  const flavoured = applyHinglish(scenario);
  assert.equal(flavoured.id, scenario.id);
  assert.equal(flavoured.expectedRisk, scenario.expectedRisk);
  assert.notEqual(flavoured, scenario);
  assert.equal(flavoured.script[0]?.text, scenario.script[0]?.hinglish);
});
