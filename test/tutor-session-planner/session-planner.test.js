import test from "node:test";
import assert from "node:assert/strict";
import { planGroundedSession, SessionPlanningError } from "../../src/tutor-core/session-planner/index.js";

function packet() {
  return {
    schema: "tutor.grounded-subject/v1", subject_id: "subject.cooking", subject_label: "Cooking",
    goal: { outcome_id: "out_cook_foundations", context_id: "ctx_home", label: "Cook a simple meal safely" },
    learner: { user_ref: "usr_synthetic_cook", profile_version: "pro_synthetic_v1", persona: "adult", accessible_routes: ["semantic_card"] },
    safety_review: "approved_for_synthetic_session",
    sources: [{ source_id: "source:cooking-approved-v1", title: "Cooking safely", url: "https://example.edu/cooking", digest: `sha256:${"a".repeat(64)}`, review_status: "approved_for_session" }],
    nodes: [
      { node_id: "cap_heat_control", label: "Control the heat", outcome: "Choose an appropriate heat adjustment from visible cooking cues.", requirements: [], activity_mechanisms: ["generic_card"], accessible_routes: ["semantic_card"], importance: "required" },
      { node_id: "cap_simple_meal", label: "Cook a simple meal", outcome: "Apply heat control in a simple meal.", requirements: [{ clause_id: "req_simple_heat", any_of: ["cap_heat_control"] }], activity_mechanisms: ["sequence"], accessible_routes: ["semantic_card"], importance: "required" }
    ]
  };
}

test("turns an approved arbitrary-subject packet into a ready objective and minimized activity brief", () => {
  const result = planGroundedSession(packet(), { now: "2026-08-04T00:00:00Z" });
  assert.equal(result.schema, "tutor.grounded-session-plan/v1");
  assert.equal(result.curriculum.subject.id, "subject.cooking");
  assert.equal(result.decision.action, "launch_assistant");
  assert.equal(result.activity_brief.node_id, "cap_heat_control");
  assert.deepEqual(result.activity_brief.source_ids, ["source:cooking-approved-v1"]);
  assert.equal(result.readiness.ready.includes("cap_heat_control"), true);
  assert.equal(result.readiness.blocked.includes("cap_simple_meal"), true);
  assert.doesNotMatch(JSON.stringify(result), /raw_transcript|learner\.message/);
});

test("rejects unapproved, non-HTTPS, or unsafely reviewed grounding", () => {
  const unapproved = packet(); unapproved.sources[0].review_status = "pending";
  assert.throws(() => planGroundedSession(unapproved), (error) => error instanceof SessionPlanningError && error.code === "source_unapproved");
  const insecure = packet(); insecure.sources[0].url = "http://example.edu/cooking";
  assert.throws(() => planGroundedSession(insecure), { code: "source_unapproved" });
  const unsafe = packet(); unsafe.safety_review = "pending";
  assert.throws(() => planGroundedSession(unsafe), { code: "safety_review_required" });
  const privatePacket = packet(); privatePacket.learner.raw_transcript = "must not enter grounding";
  assert.throws(() => planGroundedSession(privatePacket), { code: "private_grounding" });
});
