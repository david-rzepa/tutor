import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSyntheticFeedback,
  createAuthority,
  createIssueDraft,
  prepareExactPayload,
  sendExactlyConfirmed,
  SyntheticFeedbackStore,
  validateFeedbackRecord
} from "../../src/learning-feedback/index.js";

const stamp = "2026-08-04T00:00:00Z";
const versions = { assistant: "ast_v1", template: "tpl_v1", rubric: "rub_v1", measurement: "mea_v1" };

function record({ id, subject, mechanism, outcome, signal = "neutral", opportunity = 2, hints = 0, component = "cmp_activity" }) {
  return {
    schema: "tutor.learning-feedback/v1", record_id: id, subject_ref: subject,
    purpose: "measure_learning", mechanism, component, outcome, signal,
    measurement: { opportunity, elapsed_seconds: 45, hint_count: hints, challenge_delta: 0, days_delayed: outcome.includes("retain") ? 7 : 0, misconception_recurrence: outcome.startsWith("not_") ? 1 : 0, calibration_error: outcome.startsWith("not_") ? 0.5 : 0.1 },
    versions, provenance: { source: "synthetic", dataset_id: "syn_feedback_v1" }
  };
}

function authorizedStore(subjects) {
  const store = new SyntheticFeedbackStore();
  const authorities = new Map();
  for (const subject of subjects) {
    const authority = createAuthority({ subjectRef: subject, controllerRef: `ctl_${subject.slice(4)}`, grants: [{ purpose: "measure_learning", effectiveAt: stamp }] });
    store.registerAuthority(authority);
    authorities.set(subject, authority);
  }
  return { store, authorities };
}

test("authority is purpose-specific, inspectable, revocable, exportable, and deletable", () => {
  const { store, authorities } = authorizedStore(["sub_alpha", "sub_beta"]);
  store.ingest(record({ id: "rec_alpha1", subject: "sub_alpha", mechanism: "retrieval_card", outcome: "correct" }));
  assert.equal(store.export({ subjectRef: "sub_alpha", actorRef: "sub_alpha" }).records.length, 1);
  assert.throws(() => store.inspect({ subjectRef: "sub_alpha", actorRef: "sub_beta" }), { code: "cross_user_denied" });
  authorities.get("sub_alpha").withdraw("measure_learning", "2026-08-05T00:00:00Z");
  assert.equal(authorities.get("sub_alpha").inspect().purposes.measure_learning.status, "withdrawn");
  assert.equal(store.analysisSnapshot().length, 0);
  assert.throws(() => store.ingest(record({ id: "rec_alpha2", subject: "sub_alpha", mechanism: "retrieval_card", outcome: "retained" })), { code: "purpose_not_authorized" });
  assert.deepEqual(store.delete({ subjectRef: "sub_alpha", actorRef: "sub_alpha" }), { deleted: 1 });
});

test("B-001 rejects real provenance, transcripts, identifiers, contact details, and secrets", () => {
  const base = record({ id: "rec_private", subject: "sub_alpha", mechanism: "retrieval_card", outcome: "correct" });
  for (const mutation of [
    { provenance: { source: "learner", dataset_id: "dat_real" } },
    { transcript: "raw words" },
    { feedback_message: "name@example.com" },
    { quote: "verbatim" },
    { secret: "ghp_abcdefghijk" }
  ]) assert.throws(() => validateFeedbackRecord({ ...base, ...mutation }), /synthetic|field|permitted|sensitive/i);
});

test("analysis separates immediate performance, delayed retention, transfer, velocity, and guardrails", () => {
  const subjects = ["sub_alpha", "sub_beta", "sub_gamma"];
  const { store } = authorizedStore(subjects);
  let index = 0;
  for (const subject of subjects) {
    for (const outcome of ["correct", "retained", "transferred"]) store.ingest(record({ id: `rec_good${index++}`, subject, mechanism: "retrieval_card", outcome, signal: "helpful", opportunity: 2 }));
    for (const outcome of ["correct", "not_retained", "not_transferred", "stopped"]) store.ingest(record({ id: `rec_poor${index++}`, subject, mechanism: "answer_reveal", outcome, signal: outcome === "stopped" ? "too_hard" : "not_helpful", opportunity: 5, hints: 3 }));
  }
  const analysis = analyzeSyntheticFeedback(store.analysisSnapshot());
  assert.equal(analysis.findings.length, 2);
  const good = analysis.findings.find((finding) => finding.mechanism === "retrieval_card");
  const poor = analysis.findings.find((finding) => finding.mechanism === "answer_reveal");
  assert.equal(good.direction, "went_well");
  assert.deepEqual([good.metrics.immediate_performance, good.metrics.delayed_retention, good.metrics.transfer], [1, 1, 1]);
  assert.equal(poor.direction, "needs_improvement");
  assert.equal(poor.guardrails.stop_rate, 0.25);
  assert.equal(poor.metrics.mean_misconception_recurrence, 0.5);
  assert.match(poor.uncertainty, /not an efficacy claim/);
});

test("small cohorts are suppressed rather than exposed", () => {
  const one = record({ id: "rec_single", subject: "sub_alpha", mechanism: "rare_pattern", outcome: "not_retained" });
  assert.deepEqual(analyzeSyntheticFeedback([one]).findings, []);
  assert.throws(() => analyzeSyntheticFeedback([one], { minimumCohort: 2 }), { code: "unsafe_cohort" });
});

test("synthetic end-to-end analysis creates a useful deduplicable privacy-safe issue draft", () => {
  const subjects = ["sub_alpha", "sub_beta", "sub_gamma"];
  const observations = subjects.flatMap((subject, index) => [
    record({ id: `rec_delay${index}`, subject, mechanism: "answer_reveal", outcome: "not_retained", signal: "not_helpful", opportunity: 5, hints: 2 }),
    record({ id: `rec_stop${index}`, subject, mechanism: "answer_reveal", outcome: "stopped", signal: "too_hard", opportunity: 6, hints: 3 })
  ]);
  const finding = analyzeSyntheticFeedback(observations).findings[0];
  const draft = createIssueDraft(finding);
  assert.match(draft.body, /Delayed retention/);
  assert.match(draft.body, /does not establish causality/);
  assert.match(draft.body, /Synthetic reproduction/);
  assert.doesNotMatch(JSON.stringify(draft), /sub_alpha|sub_beta|sub_gamma|transcript|@/i);
  assert.equal(prepareExactPayload(draft).payloadDigest, prepareExactPayload(draft).payloadDigest);
  assert.throws(() => prepareExactPayload({ title: "unsafe", body: "Private sub_alpha", labels: ["learning-efficacy"] }), { code: "disclosure_risk" });
});

test("external issue writes require exact payload and digest confirmation", async () => {
  const finding = analyzeSyntheticFeedback(["alpha", "beta", "gamma"].map((name, index) => record({
    id: `rec_exact${index}`, subject: `sub_${name}`, mechanism: "retrieval_card", outcome: "retained", signal: "helpful"
  }))).findings[0];
  const prepared = prepareExactPayload(createIssueDraft(finding));
  let writes = 0;
  const writer = async (payload) => { writes += 1; return { number: 101, payload }; };
  await assert.rejects(sendExactlyConfirmed({ prepared, confirmedDigest: "wrong", confirmedPayload: prepared.payload, writer }), { code: "exact_confirmation_required" });
  await assert.rejects(sendExactlyConfirmed({ prepared, confirmedDigest: prepared.payloadDigest, confirmedPayload: { ...prepared.payload, title: "changed" }, writer }), { code: "exact_confirmation_required" });
  assert.equal(writes, 0);
  const result = await sendExactlyConfirmed({ prepared, confirmedDigest: prepared.payloadDigest, confirmedPayload: prepared.payload, writer });
  assert.equal(result.number, 101);
  assert.equal(writes, 1);
});
