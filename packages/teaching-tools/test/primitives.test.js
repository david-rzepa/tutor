import test from "node:test";
import assert from "node:assert/strict";
import {
  createHintLadder,
  createSeededRuntime,
  nextHint,
  recommendScaffold,
  summarizeEvidence
} from "../src/index.js";

test("seeded runtime makes replayable IDs and time", () => {
  const one = createSeededRuntime(42, 100);
  const two = createSeededRuntime(42, 100);
  assert.equal(one.nextId("attempt"), two.nextId("attempt"));
  assert.equal(one.now(), two.now());
});

test("hint ladder stops at its most supportive reviewed hint", () => {
  const ladder = createHintLadder([{ kind: "prompt" }, { kind: "worked_step" }]);
  assert.equal(nextHint(ladder, 0).kind, "prompt");
  assert.equal(nextHint(ladder, 99).kind, "worked_step");
});

test("scaffold recommendations react to sustained evidence and otherwise hold", () => {
  const errors = Array.from({ length: 3 }, () => ({ correct: false }));
  assert.deepEqual(recommendScaffold(errors, { current: "cued" }), { action: "increase", scaffold: "guided", reason: "sustained_target_errors" });
  const successes = [{ correct: true }, { correct: true }];
  assert.deepEqual(recommendScaffold(successes, { current: "guided" }), { action: "fade", scaffold: "cued", reason: "consecutive_unaided_success" });
  assert.equal(recommendScaffold([{ correct: false }], { current: "cued" }).action, "hold");
});

test("evidence summary remains domain-neutral and refuses an in-session mastery claim", () => {
  const summary = summarizeEvidence({
    objectiveId: "science.causal-system.predict",
    assistantId: "predict-observe-explain",
    assistantVersion: "1.0.0",
    attempts: [
      { correct: false, scaffold: "cued", misconception_code: "cause_effect_reversed" },
      { correct: true, scaffold: "none" }
    ],
    adaptations: [{ dimension: "scaffold", direction: "increase" }],
    stopReason: "goal_reached"
  });
  assert.equal(summary.mastery_claim, "insufficient_delayed_evidence");
  assert.deepEqual(summary.misconception_codes, ["cause_effect_reversed"]);
  assert.deepEqual(summary.adaptations, ["scaffold:increase"]);
  assert.equal(summary.unaided_attempts, 1);
});
