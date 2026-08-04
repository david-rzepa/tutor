import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ACTIVITY_BUDGET, ActivityValidationError, validateActivityConfig } from "../../examples/interactive-assistants/budget.js";
import { applyAdaptation, createActivityState, evaluateResponse } from "../../examples/interactive-assistants/template/engine.js";

const readConfig = async (name) => JSON.parse(await readFile(path.resolve("examples/interactive-assistants/configs", name), "utf8"));

test("cross-domain configurations fit the first-generation activity budget", async () => {
  const science = validateActivityConfig(await readConfig("science-change.json"));
  const music = validateActivityConfig(await readConfig("music-order.json"));
  assert.equal(science.mechanic, "choice");
  assert.equal(music.mechanic, "sequence");
  for (const config of [science, music]) {
    assert.ok(new TextEncoder().encode(JSON.stringify(config)).byteLength <= ACTIVITY_BUDGET.maxConfigBytes);
    assert.ok(config.items.length <= ACTIVITY_BUDGET.maxItems);
    assert.ok(config.limits.ui_states <= ACTIVITY_BUDGET.maxUiStates);
    assert.ok(config.limits.max_agent_callbacks <= ACTIVITY_BUDGET.maxAgentCallbacks);
  }
});

test("persistent errors request one easier scaffold and a guided success requests fading", async () => {
  const config = validateActivityConfig(await readConfig("science-change.json"));
  let state = createActivityState(config);
  let result = evaluateResponse(state, "more_light"); state = result.state;
  assert.equal(result.adaptation, null);
  result = evaluateResponse(state, "same_light"); state = result.state;
  assert.deepEqual(result.adaptation, {
    dimension: "scaffold", direction: "increase", proposed: "guided", preserves_objective: true, observed: { target_errors: 2 }
  });
  state = applyAdaptation(state, { dimension: "scaffold", scaffold: "guided" });
  result = evaluateResponse(state, "less_light");
  assert.equal(result.correct, true);
  assert.equal(result.adaptation.direction, "fade");
  assert.equal(result.state.complete, true);
});

test("invalid configuration cannot smuggle code, media, excessive states, or oversized content", async () => {
  const base = await readConfig("science-change.json");
  for (const mutation of [
    { ...base, script: "alert(1)" },
    { ...base, image: "portrait.png" },
    { ...base, answer: "missing_item" },
    { ...base, items: [base.items[0], base.items[0]] },
    { ...base, limits: { ...base.limits, ui_states: ACTIVITY_BUDGET.maxUiStates + 1 } },
    { ...base, prompt: "x".repeat(241) }
  ]) {
    assert.throws(() => validateActivityConfig(mutation), (error) => error instanceof ActivityValidationError);
  }
});
