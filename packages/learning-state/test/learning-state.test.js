import test from "node:test";
import assert from "node:assert/strict";
import { deriveReadiness, importEvidence, projectCurriculum } from "../src/index.js";

const start = Date.parse("2026-01-01T00:00:00Z");
const iso = (days) => new Date(start + days * 86_400_000).toISOString();

function node(id, requirements = [], overrides = {}) {
  return {
    node_id: id, kind: "capability", label: id, outcome: `Demonstrate ${id}.`, requirements,
    evidence_contract: { provisional: ["varied_success"], retained: ["delayed_success"], transfer: ["novel_context"] },
    misconception_ids: [], activity_mechanisms: ["generic_card"], importance: "required",
    provenance: ["source:approved-v1"], accessible_routes: ["semantic_text"], status: "active", ...overrides
  };
}

function graph(version = "v1") {
  return {
    schema: "tutor.curriculum-graph/v1", graph_id: `grf_learning_${version}`, curriculum_id: "cur_learning_v1", parents: [],
    nodes: [
      node("cap_foundation"),
      node("cap_alternative"),
      node("cap_goal", [
        { clause_id: "req_route", any_of: ["cap_foundation", "cap_alternative"] },
        { clause_id: "req_required", any_of: ["cap_foundation"] }
      ])
    ], waivers: [], created_at: iso(0)
  };
}

function event(id, node_id, day, item, overrides = {}) {
  const base = {
    schema: "tutor.evidence-event/v1", event_id: id, user_id: "usr_synthetic", curriculum_id: "cur_learning_v1",
    graph_id: "grf_learning_v1", node_id, objective_id: `obj_${node_id}`, item_version: item,
    rubric_version: "rubric_v1", assistant_version: "assistant_v1", algorithm_version: "evaluator_v1", grade: "observation",
    observation: { correct: true }, support: { scaffold: "none", help_count: 0 }, uncertainty: { confidence: 0.8 },
    privacy: { class: "learning_record", purpose: "progress_projection" }, provenance: ["source:synthetic"], observed_at: iso(day)
  };
  return { ...base, ...overrides, observation: { ...base.observation, ...overrides.observation }, support: { ...base.support, ...overrides.support } };
}

const project = (events, options = {}) => projectCurriculum({ graph: graph(), events, user_id: "usr_synthetic", now: Date.parse(iso(20)), ...options });

test("projection is invariant to event arrival order", () => {
  const events = [event("evt_a", "cap_foundation", 1, "item_a"), event("evt_b", "cap_foundation", 2, "item_b"), event("evt_c", "cap_foundation", 10, "item_c", { grade: "retained" })];
  const expected = project(events);
  for (let seed = 0; seed < 50; seed++) {
    const shuffled = [...events].sort((left, right) => ((left.event_id.charCodeAt(4) * (seed + 3)) % 7) - ((right.event_id.charCodeAt(4) * (seed + 3)) % 7));
    assert.deepEqual(project(shuffled), expected);
  }
});

test("one success or helped repetition cannot declare mastery", () => {
  const one = project([event("evt_one", "cap_foundation", 1, "item_a")]);
  assert.equal(one.nodes.cap_foundation.state, "learning");
  const helped = project([
    event("evt_help_a", "cap_foundation", 1, "item_a", { support: { scaffold: "guided", help_count: 1 } }),
    event("evt_help_b", "cap_foundation", 2, "item_b", { support: { scaffold: "cue", help_count: 1 } })
  ]);
  assert.equal(helped.nodes.cap_foundation.state, "learning");
  assert.equal(helped.nodes.cap_foundation.help_dependence, 1);
  const loneDelayed = project([event("evt_lone_retained", "cap_foundation", 10, "item_a", { grade: "retained" })]);
  assert.equal(loneDelayed.nodes.cap_foundation.state, "learning");
});

test("varied independence, delayed retention, transfer, contradiction, expiry, and deletion are explicit", () => {
  const varied = [event("evt_a", "cap_foundation", 1, "item_a"), event("evt_b", "cap_foundation", 2, "item_b")];
  assert.equal(project(varied, { now: Date.parse(iso(5)) }).nodes.cap_foundation.state, "provisional");
  const retained = [...varied, event("evt_retained", "cap_foundation", 10, "item_c", { grade: "retained" })];
  assert.equal(project(retained).nodes.cap_foundation.state, "retained");
  const transferred = [...retained, event("evt_transfer", "cap_foundation", 15, "item_d", { grade: "transfer", observation: { novel_context: true } })];
  assert.equal(project(transferred).nodes.cap_foundation.state, "transfer_verified");
  const contradicted = [...transferred, event("evt_error", "cap_foundation", 16, "item_e", { observation: { correct: false } })];
  assert.equal(project(contradicted).nodes.cap_foundation.state, "needs_review");
  const ordinaryRetry = [...contradicted, event("evt_retry", "cap_foundation", 17, "item_f")];
  assert.equal(project(ordinaryRetry).nodes.cap_foundation.state, "needs_review");
  const reverified = [...ordinaryRetry, event("evt_reverify", "cap_foundation", 18, "item_g", { grade: "retained" })];
  assert.equal(project(reverified).nodes.cap_foundation.state, "retained");
  const expired = project(retained, { now: Date.parse(iso(80)), policy: { retainedReviewMs: 30 * 86_400_000 } });
  assert.equal(expired.nodes.cap_foundation.state, "needs_review");
  assert.equal(project(retained.filter((entry) => entry.event_id !== "evt_retained"), { now: Date.parse(iso(5)) }).nodes.cap_foundation.state, "provisional");
  assert.throws(() => project([event("evt_future", "cap_foundation", 30, "item_future")]), /after the projection instant/);
  assert.throws(() => project([event("evt_duplicate", "cap_foundation", 1, "item_a"), event("evt_duplicate", "cap_foundation", 2, "item_b")]), /duplicate evidence/);
  assert.throws(() => project([event("evt_unknown", "cap_unknown", 1, "item_a")]), /unknown nodes/);
});

test("waivers satisfy only their clause and only before expiry", () => {
  const value = graph();
  value.nodes[2].requirements = [{ clause_id: "req_placement", any_of: ["waiver_placement"] }];
  value.waivers = [{ waiver_id: "waiver_placement", clause_id: "req_placement", authority: "authorized_placement", evidence_event_id: "evt_placement", expires_at: iso(30) }];
  const projection = projectCurriculum({ graph: value, events: [], user_id: "usr_synthetic", now: Date.parse(iso(20)) });
  assert.equal(deriveReadiness({ graph: value, projection, now: Date.parse(iso(20)) }).entries.cap_goal.state, "ready");
  assert.deepEqual(deriveReadiness({ graph: value, projection, now: Date.parse(iso(40)) }).entries.cap_goal.reasons, ["unsatisfied:req_placement"]);
});

test("readiness applies AND-of-OR thresholds, explanations, ranking, safety, and access", () => {
  const retained = [event("evt_a", "cap_foundation", 1, "item_a"), event("evt_b", "cap_foundation", 2, "item_b"), event("evt_r", "cap_foundation", 10, "item_c", { grade: "retained" })];
  const projection = project(retained);
  const ready = deriveReadiness({ graph: graph(), projection, now: Date.parse(iso(20)), goal_path_ids: ["cap_goal"], expected_learning_value: { cap_goal: 0.9 }, access_fit: { cap_goal: 1 } });
  assert.equal(ready.entries.cap_goal.state, "ready");
  assert.equal(ready.ranked_candidates[0], "cap_goal");
  assert.equal(ready.entries.cap_goal.score_factors.expected_learning_value, 18);
  const blocked = deriveReadiness({ graph: graph(), projection: project([]), now: Date.parse(iso(20)) });
  assert.deepEqual(blocked.entries.cap_goal.reasons.sort(), ["unsatisfied:req_required", "unsatisfied:req_route"]);
  const safety = deriveReadiness({ graph: graph(), projection, blocked_node_ids: ["cap_goal"] });
  assert.deepEqual(safety.entries.cap_goal.reasons, ["safety_or_authority_constraint"]);
  const access = deriveReadiness({ graph: graph(), projection, unavailable_routes: ["semantic_text"] });
  assert.deepEqual(access.entries.cap_goal.reasons, ["no_available_accessible_route"]);
  assert.throws(() => deriveReadiness({ graph: graph(), projection, blocked_node_ids: ["cap_typo"] }), /unknown constrained nodes/);
  assert.throws(() => deriveReadiness({ graph: graph(), projection, expected_learning_value: { cap_typo: 1 } }), /known nodes/);
  const forged = structuredClone(projection); forged.nodes.cap_goal.state = "mastered";
  assert.throws(() => deriveReadiness({ graph: graph(), projection: forged }), /projection node cap_goal is invalid/);
});

test("adding unrelated optional nodes cannot reduce existing progress or readiness", () => {
  const events = [event("evt_a", "cap_foundation", 1, "item_a"), event("evt_b", "cap_foundation", 2, "item_b"), event("evt_r", "cap_foundation", 10, "item_c", { grade: "retained" })];
  const baseGraph = graph(); const baseProjection = project(events); const baseReadiness = deriveReadiness({ graph: baseGraph, projection: baseProjection });
  const expanded = structuredClone(baseGraph); expanded.nodes.push(node("cap_optional", [], { importance: "optional" }));
  const expandedProjection = projectCurriculum({ graph: expanded, events, user_id: "usr_synthetic", now: Date.parse(iso(20)) });
  const expandedReadiness = deriveReadiness({ graph: expanded, projection: expandedProjection });
  for (const id of baseGraph.nodes.map((entry) => entry.node_id)) {
    assert.deepEqual(expandedProjection.nodes[id], baseProjection.nodes[id]);
    assert.equal(expandedReadiness.entries[id].state, baseReadiness.entries[id].state);
  }
});

test("cross-user, cross-curriculum, and graph-version evidence cannot leak", () => {
  assert.throws(() => project([event("evt_other", "cap_foundation", 1, "item_a", { user_id: "usr_other" })]), /outside user_id scope/);
  assert.throws(() => project([event("evt_other_cur", "cap_foundation", 1, "item_a", { curriculum_id: "cur_other" })]), /outside curriculum_id scope/);
  const revised = graph("v2");
  assert.throws(() => projectCurriculum({ graph: revised, events: [event("evt_old", "cap_foundation", 1, "item_a")], user_id: "usr_synthetic" }), /outside graph_id scope/);
});

test("evidence import requires authority, semantic compatibility, provenance, and uncertainty reduction", () => {
  const source = event("evt_source", "cap_foundation", 1, "item_a");
  const args = {
    event: source,
    target: { event_id: "evt_imported", user_id: "usr_synthetic", curriculum_id: "cur_learning_v1", graph_id: "grf_learning_v2", node_id: "cap_foundation_v2" },
    authorization: { approved: true, authority_id: "authority_guardian_v1" },
    compatibility: { compatible: true, mapping_id: "mapping_foundation_v2", source_node_id: "cap_foundation", target_node_id: "cap_foundation_v2" },
    uncertainty_mapping: { factor: 0.5, rule_id: "uncertainty_import_v1" }
  };
  const imported = importEvidence(args);
  assert.equal(imported.uncertainty.confidence, 0.4);
  assert.ok(imported.provenance.includes("mapping_foundation_v2"));
  assert.throws(() => importEvidence({ ...args, authorization: { approved: false, authority_id: "authority_guardian_v1" } }), /authority/);
  assert.throws(() => importEvidence({ ...args, compatibility: { ...args.compatibility, target_node_id: "cap_wrong" } }), /compatibility/);
});
