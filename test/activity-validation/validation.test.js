import assert from "node:assert/strict";
import test from "node:test";
import { validateActivity } from "../../packages/activity-validation/src/index.js";

const sha = (digit) => `sha256:${digit.repeat(64)}`;
const fallback = { id: "reviewed_fallback", review_status: "approved", digest: sha("f") };

function candidate(domain = "science") {
  const facts = {
    science: ["Which change closes the circuit?", ["Connect the gap", "Remove the cell"]],
    music: ["Which pattern matches the target rhythm?", ["Long short short", "Three long beats"]],
    mathematics: ["Which representation is equivalent?", ["Six eighths", "Six tenths"]]
  };
  const [prompt, labels] = facts[domain];
  return {
    schema: "tutor.activity-candidate/v1", activity_id: `act_${domain}`,
    objective: { node_id: `nod_${domain}`, operation: "compare_options", construct: "concept_discrimination" },
    item: { node_id: `nod_${domain}`, operation: "compare_options", prompt, options: labels.map((label, index) => ({ id: `opt_${index + 1}`, label })), answer_id: "opt_1", rubric_version: "rub_v1" },
    feedback: { actionable_retry: true, reveals_before_attempt: false },
    claims: [{ claim_id: "clm_target", source_id: "src_approved" }], approved_sources: ["src_approved"],
    accessibility: { keyboard: true, screen_reader_status: true, reduced_motion: true, routes: [{ modality: "text", construct: "concept_discrimination", semantic: true, timed: false }] },
    safety: { stop_visible: true, correction_path: true, external_links: false, open_generation: false },
    protocol: { version: "tutor.assistant/v1", sandbox: "opaque-origin", network: false, capabilities: ["attempt.recorded", "session.stopped"] },
    budget: { files: 2, bytes: 4096, ui_states: 4, agent_callbacks: 0, build_ms: 25 },
    provenance: { curriculum_version: "cur_v1", content_version: "con_v1", rubric_version: "rub_v1", model_version: "mod_v1", curriculum_digest: sha("1"), content_digest: sha("2"), rubric_digest: sha("3"), model_digest: sha("4") }
  };
}

function passingJudgments(activity) {
  return [
    ["answerability", "answerable"], ["rubric_consistency", "rubric_consistent"], ["factual_grounding", "grounded"], ["level_fit", "level_fit"], ["bias_safety", "neutral"], ["construct_equivalence", "equivalent"]
  ].map(([gate, rationale_code]) => ({ gate, status: "pass", confidence: 0.8, rationale_code, model_version: activity.provenance.model_version }));
}

test("cross-domain valid fixtures publish through one subject-neutral pipeline", async () => {
  for (const domain of ["science", "music", "mathematics"]) {
    const activity = candidate(domain);
    const report = await validateActivity(activity, { judge: passingJudgments, fallback });
    assert.equal(report.passed, true);
    assert.equal(report.publication.action, "publish");
    assert.match(report.candidate_digest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(report.provenance, activity.provenance);
  }
});

test("deterministic adversarial gates reject answerability, keys, leakage, rubrics, and sources", async () => {
  const mutations = [
    (item) => { item.item.options = []; },
    (item) => { item.item.answer_id = "opt_missing"; },
    (item) => { item.item.prompt = `Choose ${item.item.options[0].label}`; },
    (item) => { item.item.rubric_version = "rub_wrong"; },
    (item) => { item.claims[0].source_id = "src_unknown"; }
  ];
  for (const mutate of mutations) {
    const activity = structuredClone(candidate()); mutate(activity);
    const report = await validateActivity(activity, { judge: passingJudgments, fallback });
    assert.equal(report.deterministic.passed, false);
    assert.equal(report.publication.action, "fallback");
    assert.equal(report.judgments.length, 0);
  }
});

test("accessibility alternatives preserve the construct and required access routes", async () => {
  const activity = candidate();
  activity.accessibility.routes[0].construct = "reading_speed";
  const report = await validateActivity(activity, { judge: passingJudgments, fallback });
  assert.equal(report.deterministic.findings.some((item) => item.gate === "accessibility"), true);
  assert.equal(report.publication.artifact_id, "reviewed_fallback");
});

test("privacy, safety, bias judgment, and protocol or sandbox escapes fail closed", async () => {
  for (const mutate of [
    (item) => { item.learner_name = "Private Person"; },
    (item) => { item.safety.stop_visible = false; },
    (item) => { item.protocol.network = true; },
    (item) => { item.protocol.capabilities.push("filesystem.read"); },
    (item) => { item.application_code = "fetch('https://example.invalid')"; }
  ]) {
    const activity = structuredClone(candidate()); mutate(activity);
    const report = await validateActivity(activity, { judge: passingJudgments, fallback });
    assert.equal(report.passed, false);
    assert.equal(report.publication.action, "fallback");
  }
  const activity = candidate();
  const report = await validateActivity(activity, { judge: (value) => passingJudgments(value).map((entry) => entry.gate === "bias_safety" ? { ...entry, status: "fail", rationale_code: "bias_risk" } : entry), fallback });
  assert.equal(report.human_review_required, true);
  assert.equal(report.publication.action, "fallback");
});

test("bounded judgment uncertainty cannot claim correctness or override gates", async () => {
  const report = await validateActivity(candidate(), { judge: () => [], fallback });
  assert.equal(report.passed, false);
  assert.equal(report.human_review_required, true);
  assert.match(report.uncertainty, /not proof/);
  assert.equal(report.publication.action, "fallback");
});

test("semantic judgments reject plausible but wrong keys and unanswerable wording", async () => {
  for (const [gate, rationale_code] of [["rubric_consistency", "rubric_inconsistent"], ["answerability", "unanswerable"]]) {
    const activity = candidate();
    const report = await validateActivity(activity, {
      fallback,
      judge: (value) => passingJudgments(value).map((entry) => entry.gate === gate ? { ...entry, status: "fail", rationale_code } : entry)
    });
    assert.equal(report.deterministic.passed, true);
    assert.equal(report.judgments.find((entry) => entry.gate === gate).status, "fail");
    assert.equal(report.publication.action, "fallback");
  }
});

test("judgment timeout uses a reviewed fallback without publishing partial output", async () => {
  const report = await validateActivity(candidate(), { judge: () => new Promise(() => {}), timeoutMs: 5, fallback });
  assert.equal(report.judgments.every((entry) => entry.rationale_code === "timeout"), true);
  assert.equal(report.passed, false);
  assert.equal(report.publication.action, "fallback");
});

test("invalid judgment services fail closed into reviewed fallback", async () => {
  const report = await validateActivity(candidate(), { judge: async () => { throw new Error("provider failed"); }, fallback });
  assert.equal(report.judgments.every((entry) => entry.status === "uncertain"), true);
  assert.equal(report.publication.action, "fallback");
});

test("invalid output without a reviewed fallback stops cleanly", async () => {
  const activity = candidate(); activity.protocol.network = true;
  const report = await validateActivity(activity, { fallback: { ...fallback, review_status: "draft" } });
  assert.deepEqual(report.publication, { action: "stop", reason: "no_reviewed_safe_artifact" });
});

test("construction budgets reject oversized on-demand assistants", async () => {
  const activity = candidate(); activity.budget.bytes = 64 * 1024 + 1;
  const report = await validateActivity(activity, { judge: passingJudgments, fallback });
  assert.equal(report.deterministic.findings.some((item) => item.code === "construction_budget"), true);
});
