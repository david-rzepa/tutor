import test from "node:test";
import assert from "node:assert/strict";
import {
  CurriculumValidationError, findCycle, topologicalSort, validateChangeSet, validateCurriculum,
  validateEvidenceEvent, validateGraphStructure, validateMisconception, validateRubric
} from "../src/index.js";

const stamp = "2026-08-04T00:00:00Z";

function node(id, requirements = [], overrides = {}) {
  return {
    node_id: id, kind: "capability", label: id.replaceAll("_", " "), outcome: `Demonstrate ${id}.`, requirements,
    evidence_contract: { provisional: ["varied_success"], retained: ["delayed_success"], transfer: ["novel_context"] },
    misconception_ids: [], activity_mechanisms: ["generic_card"], importance: "required",
    provenance: ["source:approved-v1"], accessible_routes: ["semantic_list"], status: "active", ...overrides
  };
}

function graph(domain = "science", count = 6) {
  const nodes = [];
  for (let index = 0; index < count; index++) {
    const id = `cap_${domain}_${index}`;
    nodes.push(node(id, index ? [{ clause_id: `req_${domain}_${index}`, any_of: [`cap_${domain}_${index - 1}`] }] : []));
  }
  return { schema: "tutor.curriculum-graph/v1", graph_id: `grf_${domain}_v1`, curriculum_id: `cur_${domain}_v1`, parents: [], nodes, waivers: [], created_at: stamp };
}

test("valid cross-domain DAGs sort deterministically and remain reachable", () => {
  for (const domain of ["science", "music", "mathematics"]) {
    for (let size = 2; size <= 20; size++) {
      const value = graph(domain, size);
      const result = validateGraphStructure(value);
      assert.deepEqual(result.order, value.nodes.map((entry) => entry.node_id));
      assert.equal(result.reachable.length, size);
      assert.deepEqual(topologicalSort(structuredClone(value)), result.order);
    }
  }
});

test("AND-of-OR clauses accept alternate foundations but require every clause", () => {
  const value = graph("routes", 1);
  value.nodes.push(node("cap_route_a"), node("cap_route_b"), node("cap_required"));
  value.nodes.push(node("cap_goal", [
    { clause_id: "req_any_route", any_of: ["cap_route_a", "cap_route_b"] },
    { clause_id: "req_required", any_of: ["cap_required"] }
  ]));
  const result = validateGraphStructure(value);
  assert.ok(result.reachable.includes("cap_goal"));
  value.nodes.find((entry) => entry.node_id === "cap_required").status = "archived";
  assert.throws(() => validateGraphStructure(value), /required nodes are unreachable/);
});

test("cycle diagnostics return an exact real cycle", () => {
  const value = graph("cycle", 3);
  value.nodes[0].requirements = [{ clause_id: "req_cycle_back", any_of: [value.nodes[2].node_id] }];
  assert.deepEqual(findCycle(value), ["cap_cycle_0", "cap_cycle_1", "cap_cycle_2", "cap_cycle_0"]);
  assert.throws(() => validateGraphStructure(value), (error) => error instanceof CurriculumValidationError && /cap_cycle_0 -> cap_cycle_1/.test(error.message));
});

test("generated invalid DAGs expose real cycles across domains and sizes", () => {
  for (const domain of ["science", "music", "mathematics"]) for (let size = 2; size <= 12; size++) {
    const value = graph(`${domain}_invalid`, size);
    value.nodes[0].requirements = [{ clause_id: `req_${domain}_back`, any_of: [value.nodes.at(-1).node_id] }];
    const cycle = findCycle(value);
    assert.equal(cycle[0], value.nodes[0].node_id);
    assert.equal(cycle.at(-1), cycle[0]);
    assert.throws(() => validateGraphStructure(value), CurriculumValidationError);
  }
});

test("graph validation rejects bad references, duplicate IDs, inaccessible nodes, and unscoped waivers", () => {
  const mutations = [];
  const unknown = graph(); unknown.nodes[1].requirements[0].any_of = ["cap_missing"]; mutations.push(unknown);
  const duplicate = graph(); duplicate.nodes[1].node_id = duplicate.nodes[0].node_id; mutations.push(duplicate);
  const inaccessible = graph(); inaccessible.nodes[1].accessible_routes = []; mutations.push(inaccessible);
  const waiver = graph(); waiver.waivers = [{ waiver_id: "waiver_bad", clause_id: "req_missing", authority: "authorized", evidence_event_id: "evt_synthetic", expires_at: stamp }]; mutations.push(waiver);
  const archivedRoute = graph(); archivedRoute.nodes[0].status = "archived"; mutations.push(archivedRoute);
  const wrongScope = graph(); wrongScope.waivers = [{ waiver_id: "waiver_scoped", clause_id: "req_science_1", authority: "authorized", evidence_event_id: "evt_synthetic", expires_at: "2026-09-01T00:00:00Z" }]; wrongScope.nodes[2].requirements[0].any_of = ["waiver_scoped"]; mutations.push(wrongScope);
  const oversized = graph(); oversized.nodes[1].requirements[0].any_of = Array.from({ length: 17 }, (_, index) => `cap_alternative_${index}`); mutations.push(oversized);
  for (const value of mutations) assert.throws(() => validateGraphStructure(value), CurriculumValidationError);
});

test("curriculum and evidence contracts bind opaque users and every producing version", () => {
  const curriculum = validateCurriculum({
    schema: "tutor.curriculum/v1", curriculum_id: "cur_science_v1", user_id: "usr_synthetic_1",
    subject: { id: "science.general", label: "General science" }, goal: { statement: "Explain simple systems", target_horizon: "open" },
    graph_version: "grf_science_v1", status: "active",
    generated_from: { profile_head: "hed_profile_1", diagnostic_event_set: `sha256:${"0".repeat(64)}`, sources: ["source:approved-v1"] }, created_at: stamp, extensions: {}
  });
  assert.equal(curriculum.subject.id, "science.general");
  const event = validateEvidenceEvent({
    schema: "tutor.evidence-event/v1", event_id: "evt_synthetic_1", user_id: "usr_synthetic_1", curriculum_id: "cur_science_v1",
    graph_id: "grf_science_v1", node_id: "cap_science_1", objective_id: "obj_science_1", item_version: "item_v1",
    rubric_version: "rubric_v1", assistant_version: "assistant_v1", algorithm_version: "projection_v1", grade: "provisional",
    observation: { correct: true }, support: { scaffold: "none", help_count: 0 }, uncertainty: { confidence: 0.7 },
    privacy: { class: "learning_record", purpose: "progress_projection" }, provenance: ["source:synthetic"], observed_at: stamp
  });
  assert.equal(event.grade, "provisional");
});

test("private data and incomplete evidence versions are rejected", () => {
  const base = {
    schema: "tutor.evidence-event/v1", event_id: "evt_synthetic_1", user_id: "usr_synthetic_1", curriculum_id: "cur_science_v1",
    graph_id: "grf_science_v1", node_id: "cap_science_1", objective_id: "obj_science_1", item_version: "item_v1",
    rubric_version: "rubric_v1", assistant_version: "assistant_v1", algorithm_version: "projection_v1", grade: "retained",
    observation: { correct: true }, support: { scaffold: "none", help_count: 0 }, uncertainty: { confidence: 0.8 },
    privacy: { class: "learning_record", purpose: "progress_projection" }, provenance: ["source:synthetic"], observed_at: stamp
  };
  assert.throws(() => validateEvidenceEvent({ ...base, transcript: "private" }), /private identity/);
  assert.throws(() => validateEvidenceEvent({ ...base, full_name: "Private learner", workspace_path: "C:/private" }), /private identity/);
  assert.throws(() => validateEvidenceEvent({ ...base, observation: { correct: true, response: "raw answer" } }), /non-structured fields/);
  const missingVersion = structuredClone(base); delete missingVersion.rubric_version;
  assert.throws(() => validateEvidenceEvent(missingVersion), /rubric_version/);
});

test("change sets require explicit safe semantic mappings", () => {
  const valid = validateChangeSet({
    schema: "tutor.curriculum-change-set/v1", change_set_id: "chg_science_v2", curriculum_id: "cur_science_v1",
    from_graph_id: "grf_science_v1", to_graph_id: "grf_science_v2",
    changes: [{ operation: "split", from: ["cap_trace"], to: ["cap_direction", "cap_link"], rationale: "Outcome was too broad.", confidence: 0.6 }]
  });
  assert.equal(valid.changes[0].operation, "split");
  assert.throws(() => validateChangeSet({ ...valid, changes: [{ operation: "supersede", from: ["cap_old"], to: ["cap_old"], rationale: "Changed", confidence: 1 }] }), /new node IDs/);
  assert.throws(() => validateChangeSet({ ...valid, changes: [{ operation: "split", from: ["cap_one", "cap_two"], to: ["cap_a", "cap_b"], rationale: "Bad split", confidence: 1 }] }), /one source/);
});

test("rubric and misconception contracts are versioned, observable, accessible, and grounded", () => {
  const rubric = validateRubric({
    schema: "tutor.rubric/v1", rubric_id: "rubric_prediction", version: "rubric_v1", objective_id: "obj_prediction",
    criteria: [{ criterion_id: "criterion_reasoning", description: "Explanation links cause and effect.", levels: [
      { level_id: "level_emerging", description: "Names a change." }, { level_id: "level_secure", description: "Links change to outcome." }
    ] }], accessible_routes: ["semantic_text", "spoken_observation"], provenance: ["source:approved-v1"]
  });
  assert.equal(rubric.criteria.length, 1);
  const misconception = validateMisconception({
    schema: "tutor.misconception/v1", misconception_id: "misconception_linear", objective_id: "obj_prediction",
    description: "Assumes every relationship is linear.", observable_pattern: "Repeats proportional predictions when feedback is present.",
    counter_evidence: ["novel_feedback_system"], provenance: ["source:approved-v1"]
  });
  assert.equal(misconception.counter_evidence[0], "novel_feedback_system");
  assert.throws(() => validateRubric({ ...rubric, accessible_routes: [] }), /accessible evidence routes/);
  assert.throws(() => validateMisconception({ ...misconception, diagnosis: "private" }), /private identity/);
});
