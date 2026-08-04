import assert from "node:assert/strict";
import test from "node:test";
import { decideTutorAction } from "../../src/tutor-core/orchestrator/index.js";

function input(overrides = {}) { return { schema: "tutor.orchestration-input/v1", authority: { decision: "allow" }, control: {}, graph_id: "grf_generic_v1", projection_version: "prj_v1", ephemeral_profile_ref: "eph_session1", candidates: [{ node_id: "cap_target", ready: true, safety_allowed: true, access_fit: true, verification_due: false, expected_learning_value: 0.8, goal_path: 1, prerequisite_leverage: 1, uncertainty_reduction: 0.5, flow_fit: 0.5, rubric_version: "rub_v1", content_version: "con_v1", access_route: "semantic_card" }], recent: {}, ...overrides }; }

test("expected learning value and due verification outrank flow", () => {
  const value = input(); value.candidates.push({ ...value.candidates[0], node_id: "cap_flow", verification_due: false, expected_learning_value: 0.2, flow_fit: 1 });
  assert.equal(decideTutorAction(value).objective.node_id, "cap_target");
  value.candidates[1].verification_due = true; assert.equal(decideTutorAction(value).objective.node_id, "cap_flow");
});
test("persistent error requests one easier scaffold", () => assert.equal(decideTutorAction(input({ recent: { consecutive_target_errors: 3, help_count: 2 } })).adaptation, "increase_one_scaffold"));
test("guided success fades support without claiming mastery", () => { const result = decideTutorAction(input({ recent: { guided_success: true, independent_success: false } })); assert.equal(result.adaptation, "fade_one_support"); assert.equal(result.mastery_update, "no_mastery_claim"); });
test("learner questions get a concise-chat bridge back to an assistant", () => assert.equal(decideTutorAction(input({ recent: { learner_question: true } })).action, "answer_then_assistant"));
test("known misconceptions materialize a tailored mini-assistant", () => { const result = decideTutorAction(input({ recent: { known_misconception: true } })); assert.equal(result.action, "tailored_mini_assistant"); assert.equal(result.adaptation, "contrast_misconception"); });
test("pause, stop, safety, and authority outrank pedagogy", () => { assert.equal(decideTutorAction(input({ control: { pause: true } })).action, "pause"); assert.equal(decideTutorAction(input({ control: { stop: true } })).action, "stop"); assert.equal(decideTutorAction(input({ authority: { decision: "deny" } })).action, "stop"); });
test("inaccessible activity substitutes route without lowering knowledge", () => { const result = decideTutorAction(input({ recent: { access_barrier: true, consecutive_target_errors: 4 } })); assert.equal(result.action, "substitute_assistant"); assert.equal(result.reason_codes.includes("access_not_knowledge"), true); });
test("delayed verification schedules results and only full evidence permits projection", () => { const value = input(); value.candidates[0].verification_due = true; value.recent = { varied_independent: true, delayed_retained: true, transfer_success: true }; const result = decideTutorAction(value); assert.equal(result.mastery_update, "eligible_for_projection"); assert.equal(result.schedule, "record_verification_result"); });
test("assistant slice excludes profiles and callbacks are bounded", () => { const result = decideTutorAction(input()); assert.deepEqual(Object.keys(result.assistant_slice), ["access_route", "capabilities", "ephemeral_profile_ref", "node_id"]); assert.equal(result.callback.max_requests, 1); assert.doesNotMatch(JSON.stringify(result), /transcript|user_id|profile_history/); });
