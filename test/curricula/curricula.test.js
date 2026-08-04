import assert from "node:assert/strict";
import test from "node:test";
import { correctGenerationSlice, createGenerationSlice, CurriculumLifecycle, generateCurriculum, publishRevision } from "../../src/tutor-core/curricula/index.js";

const now = "2026-08-04T00:00:00Z";
function node(id, prior = null) { return { node_id: id, label: id, outcome: `Demonstrate ${id}`, requirements: prior ? [{ clause_id: `req_${id}`, any_of: [prior] }] : [], activity_mechanisms: ["generic_card"], accessible_routes: ["semantic_list"] }; }
function template(domain) { return { template_id: `tpl_${domain}`, review_status: "approved", source_ids: [`source:${domain}-approved-v1`], source_digest: `sha256:${"1".repeat(64)}`, subject_label: domain, goal_labels: { out_apply: `Apply ${domain}` }, nodes: [node(`cap_${domain}_foundation`), node(`cap_${domain}_apply`, `cap_${domain}_foundation`)] }; }
function profile(domain) { return { user_ref: `usr_${domain}`, profile_version: `pro_${domain}_v1`, age_band: "adult", goals: [{ subject_id: `subject.${domain}`, outcome_id: "out_apply", context_id: "ctx_personal" }], access: { output_routes: ["text"], supports: ["no_time_pressure"] } }; }
function registry(domains = ["science", "music", "mathematics"]) { return new Map([...domains.map((domain) => [`subject.${domain}`, template(domain)]), ["reviewed_fallback", { template_id: "tpl_reviewed_fallback", review_status: "approved" }]]); }

test("three domains generate distinct valid accessible curricula without subject branches", () => {
  for (const domain of ["science", "music", "mathematics"]) {
    const result = generateCurriculum({ request: createGenerationSlice(profile(domain), `subject.${domain}`), registry: registry(), now });
    assert.equal(result.status, "generated"); assert.equal(result.graph.nodes.length, 2);
    assert.equal(result.graph.nodes.every((entry) => entry.accessible_routes.includes("text")), true);
    assert.equal(result.curriculum.generated_from.sources[0], `source:${domain}-approved-v1`);
    assert.match(result.explanation.uncertainty, /foundations remain visible/);
  }
});

test("placement is bounded, optional, expiring, uncertainty-aware, and correctable", () => {
  const request = createGenerationSlice(profile("science"), "subject.science");
  const uncertain = generateCurriculum({ request, registry: registry(), now, placement: [{ node_id: "cap_science_foundation", decision: "waive_prerequisite", confidence: 0.5 }] });
  assert.equal(uncertain.graph.waivers.length, 0); assert.equal(uncertain.explanation.placement[0].action, "diagnostic_required");
  const placed = generateCurriculum({ request, registry: registry(), now, placement: [{ node_id: "cap_science_foundation", decision: "waive_prerequisite", confidence: 0.9, evidence_event_id: "evt_synthetic", authority_id: "aut_placement", expires_at: "2026-09-04T00:00:00Z" }] });
  assert.equal(placed.graph.waivers.length, 1); assert.equal(placed.explanation.correction_actions.includes("remove_waiver"), true);
  assert.throws(() => generateCurriculum({ request, registry: registry(), now, placement: Array(9).fill({ node_id: "cap_science_foundation", decision: "keep", confidence: 1 }) }), /eight/);
});

test("ungrounded or invalid generation uses reviewed fallback or planning gate", () => {
  const request = createGenerationSlice(profile("science"), "subject.science");
  assert.equal(generateCurriculum({ request, registry: registry([]), now }).status, "fallback");
  const noFallback = new Map(); assert.equal(generateCurriculum({ request, registry: noFallback, now }).status, "planning_required");
  const broken = registry(); broken.get("subject.science").nodes[1].requirements[0].any_of = ["cap_missing"];
  assert.equal(generateCurriculum({ request, registry: broken, now }).status, "fallback");
});

test("generation slices exclude full profile history and private hypotheses", () => {
  const full = { ...profile("science"), hypotheses: [{ private: "not sent" }], authority_history: ["not sent"] };
  const slice = createGenerationSlice(full, "subject.science");
  assert.deepEqual(Object.keys(slice), ["accessible_routes", "age_band", "goal", "profile_version", "schema", "subject_id", "user_ref"]);
  assert.doesNotMatch(JSON.stringify(slice), /hypoth|authority_history|private/);
});

test("authorized corrections change only minimized goals and access routes", () => {
  const slice = createGenerationSlice(profile("science"), "subject.science");
  const corrected = correctGenerationSlice(slice, { authorized: true, context_id: "ctx_changed", accessible_routes: ["screen_reader", "no_time_pressure"] });
  assert.equal(corrected.goal.context_id, "ctx_changed");
  assert.deepEqual(corrected.accessible_routes, ["no_time_pressure", "screen_reader"]);
  assert.throws(() => correctGenerationSlice(slice, { authorized: false, context_id: "ctx_changed" }), { code: "correction_denied" });
  assert.throws(() => correctGenerationSlice(slice, { authorized: true, history: ["private"] }), { code: "correction_scope" });
});

test("approved templates retain AND-of-OR prerequisite alternatives", () => {
  const source = registry();
  const value = source.get("subject.music");
  value.nodes.splice(1, 0, node("cap_music_alternative"));
  value.nodes.at(-1).requirements[0].any_of.push("cap_music_alternative");
  const result = generateCurriculum({ request: createGenerationSlice(profile("music"), "subject.music"), registry: source, now });
  assert.deepEqual(result.graph.nodes.at(-1).requirements[0].any_of.sort(), ["cap_music_alternative", "cap_music_foundation"]);
});

test("immutable revisions require ancestry and explicit semantic mappings", () => {
  const request = createGenerationSlice(profile("science"), "subject.science"); const source = registry(); const lifecycle = new CurriculumLifecycle();
  const first = generateCurriculum({ request, registry: source, now, revision: 1 }); lifecycle.publish(first);
  const revisedTemplate = structuredClone(source.get("subject.science")); revisedTemplate.template_id = "tpl_science_v2";
  revisedTemplate.nodes = [node("cap_science_foundation"), node("cap_science_explain", "cap_science_foundation"), node("cap_science_apply_v2", "cap_science_explain")]; source.set("subject.science", revisedTemplate);
  const second = generateCurriculum({ request, registry: source, now: "2026-08-05T00:00:00Z", revision: 2, parentGraphId: first.graph.graph_id }); lifecycle.publish(second);
  const revision = publishRevision({ prior: first, next: second, changes: [{ operation: "split", from: ["cap_science_apply"], to: ["cap_science_explain", "cap_science_apply_v2"], rationale: "Separate explanation from application", confidence: 0.8 }] });
  assert.equal(revision.changeSet.changes[0].operation, "split");
  assert.equal(revision.evidence_mappings[0].transfer, "requires_explicit_semantic_review");
  assert.equal(lifecycle.history(first.curriculum.curriculum_id).length, 2);
});
