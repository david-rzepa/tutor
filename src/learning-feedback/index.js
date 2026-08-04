import { createHash } from "node:crypto";

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const PURPOSES = new Set(["improve_teaching", "measure_learning", "accessibility_quality"]);
const OUTCOMES = new Set(["correct", "incorrect", "retained", "not_retained", "transferred", "not_transferred", "stopped"]);
const SIGNALS = new Set(["helpful", "not_helpful", "too_hard", "too_easy", "accessible", "access_barrier", "neutral"]);
const ISSUE_LABELS = new Set(["learning-efficacy", "privacy-reviewed-draft", "synthetic-evidence"]);
const BLOCKED_KEY = /(name|email|phone|address|transcript|message|quote|secret|token|password|diagnosis|disability|birth|learner_id|user_id|subject_id)/i;
const SENSITIVE_TEXT = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:sk|ghp|github_pat)_[a-z0-9_-]{8,}|\b\+?\d[\d ()-]{7,}\d\b|\busr_[a-z0-9_-]+\b)/i;

export class FeedbackError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FeedbackError";
    this.code = code;
    this.details = details;
  }
}

function assertId(value, field) {
  if (typeof value !== "string" || !ID.test(value)) throw new FeedbackError("invalid_id", `${field} must be an opaque ID`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function finite(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isFinite(value) || value < min || value > max) throw new FeedbackError("invalid_measurement", `${field} is out of bounds`);
}

function rejectRaw(value, trail = "record") {
  if (typeof value === "string") {
    if (value.length > 200 || SENSITIVE_TEXT.test(value)) throw new FeedbackError("sensitive_content", `${trail} contains sensitive or unbounded text`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry, index) => rejectRaw(entry, `${trail}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_KEY.test(key)) throw new FeedbackError("raw_reserved", `${trail}.${key} is not permitted`);
    rejectRaw(entry, `${trail}.${key}`);
  }
}

export function createAuthority({ subjectRef, controllerRef, grants = [] }) {
  assertId(subjectRef, "subjectRef");
  assertId(controllerRef, "controllerRef");
  const state = new Map();
  const history = [];
  let revision = 0;

  function change(purpose, status, effectiveAt) {
    if (!PURPOSES.has(purpose)) throw new FeedbackError("unknown_purpose", `Unknown purpose: ${purpose}`);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(effectiveAt)) throw new FeedbackError("invalid_time", "Authority changes require an ISO timestamp");
    revision += 1;
    state.set(purpose, { status, effectiveAt, revision });
    history.push(Object.freeze({ purpose, status, effectiveAt, revision, controllerRef }));
    return revision;
  }

  for (const grant of grants) change(grant.purpose, "granted", grant.effectiveAt);
  return Object.freeze({
    subjectRef,
    grant: (purpose, effectiveAt) => change(purpose, "granted", effectiveAt),
    withdraw: (purpose, effectiveAt) => change(purpose, "withdrawn", effectiveAt),
    permits: (purpose) => state.get(purpose)?.status === "granted",
    inspect: () => ({ schema: "tutor.feedback-authority/v1", subjectRef, revision, purposes: stable(Object.fromEntries(state)), history: [...history] })
  });
}

export function validateFeedbackRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new FeedbackError("invalid_record", "Feedback record must be an object");
  const allowed = new Set(["schema", "record_id", "subject_ref", "purpose", "mechanism", "component", "outcome", "signal", "measurement", "versions", "provenance"]);
  for (const key of Object.keys(record)) if (!allowed.has(key)) throw new FeedbackError("unknown_field", `Unknown feedback field: ${key}`);
  if (record.schema !== "tutor.learning-feedback/v1") throw new FeedbackError("invalid_schema", "Unsupported feedback schema");
  for (const field of ["record_id", "subject_ref", "mechanism", "component"]) assertId(record[field], field);
  if (!PURPOSES.has(record.purpose)) throw new FeedbackError("unknown_purpose", "Feedback purpose is not supported");
  if (!OUTCOMES.has(record.outcome) || !SIGNALS.has(record.signal)) throw new FeedbackError("invalid_observation", "Outcome and signal must use reviewed codes");
  const measurement = record.measurement ?? {};
  const measurementKeys = new Set(["opportunity", "elapsed_seconds", "hint_count", "challenge_delta", "days_delayed", "misconception_recurrence", "calibration_error"]);
  for (const key of Object.keys(measurement)) if (!measurementKeys.has(key)) throw new FeedbackError("invalid_measurement", `Unknown measurement: ${key}`);
  finite(measurement.opportunity, "opportunity", { min: 1, max: 10_000 });
  finite(measurement.elapsed_seconds, "elapsed_seconds", { max: 86_400 });
  finite(measurement.hint_count, "hint_count", { max: 100 });
  finite(measurement.challenge_delta, "challenge_delta", { min: -10, max: 10 });
  finite(measurement.days_delayed, "days_delayed", { max: 3_650 });
  finite(measurement.misconception_recurrence, "misconception_recurrence", { max: 100 });
  finite(measurement.calibration_error, "calibration_error", { max: 1 });
  if (!record.versions || !["assistant", "template", "rubric", "measurement"].every((key) => ID.test(record.versions[key]))) {
    throw new FeedbackError("missing_versions", "Assistant, template, rubric, and measurement versions are required");
  }
  if (record.provenance?.source !== "synthetic" || !ID.test(record.provenance.dataset_id)) {
    throw new FeedbackError("real_data_blocked", "B-001 permits synthetic provenance only");
  }
  rejectRaw(record);
  return Object.freeze(stable(record));
}

export class SyntheticFeedbackStore {
  #records = new Map();
  #authorities = new Map();

  registerAuthority(authority) {
    this.#authorities.set(authority.subjectRef, authority);
  }

  ingest(record) {
    const validated = validateFeedbackRecord(record);
    const authority = this.#authorities.get(validated.subject_ref);
    if (!authority?.permits(validated.purpose)) throw new FeedbackError("purpose_not_authorized", "Purpose is not currently authorized");
    const existing = this.#records.get(validated.record_id);
    if (existing && canonical(existing) !== canonical(validated)) throw new FeedbackError("record_collision", "Immutable record ID has different content");
    this.#records.set(validated.record_id, validated);
    return validated.record_id;
  }

  inspect({ subjectRef, actorRef }) {
    if (subjectRef !== actorRef) throw new FeedbackError("cross_user_denied", "A subject may inspect only their own records");
    return [...this.#records.values()].filter((record) => record.subject_ref === subjectRef).map(stable);
  }

  export(options) {
    return { schema: "tutor.feedback-export/v1", subject_ref: options.subjectRef, records: this.inspect(options) };
  }

  delete({ subjectRef, actorRef }) {
    if (subjectRef !== actorRef) throw new FeedbackError("cross_user_denied", "A subject may delete only their own records");
    let deleted = 0;
    for (const [id, record] of this.#records) if (record.subject_ref === subjectRef) { this.#records.delete(id); deleted += 1; }
    return { deleted };
  }

  analysisSnapshot() {
    return [...this.#records.values()]
      .filter((record) => this.#authorities.get(record.subject_ref)?.permits(record.purpose))
      .map(stable);
  }
}

function rate(count, total) {
  return total ? Number((count / total).toFixed(3)) : null;
}

export function analyzeSyntheticFeedback(records, { minimumCohort = 3 } = {}) {
  if (!Number.isInteger(minimumCohort) || minimumCohort < 3) throw new FeedbackError("unsafe_cohort", "Minimum cohort must be at least three");
  const validated = records.map(validateFeedbackRecord);
  const groups = new Map();
  for (const record of validated) {
    const group = groups.get(record.mechanism) ?? [];
    group.push(record);
    groups.set(record.mechanism, group);
  }
  const findings = [];
  for (const [mechanism, observations] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const subjects = new Set(observations.map((item) => item.subject_ref));
    if (subjects.size < minimumCohort) continue;
    const immediate = observations.filter((item) => ["correct", "incorrect"].includes(item.outcome));
    const delayed = observations.filter((item) => ["retained", "not_retained"].includes(item.outcome));
    const transfer = observations.filter((item) => ["transferred", "not_transferred"].includes(item.outcome));
    const guardrails = {
      stop_rate: rate(observations.filter((item) => item.outcome === "stopped").length, observations.length),
      access_barrier_rate: rate(observations.filter((item) => item.signal === "access_barrier").length, observations.length),
      too_hard_rate: rate(observations.filter((item) => item.signal === "too_hard").length, observations.length),
      mean_hint_count: Number((observations.reduce((sum, item) => sum + item.measurement.hint_count, 0) / observations.length).toFixed(2))
    };
    const metrics = {
      immediate_performance: rate(immediate.filter((item) => item.outcome === "correct").length, immediate.length),
      delayed_retention: rate(delayed.filter((item) => item.outcome === "retained").length, delayed.length),
      transfer: rate(transfer.filter((item) => item.outcome === "transferred").length, transfer.length),
      mean_opportunities: Number((observations.reduce((sum, item) => sum + item.measurement.opportunity, 0) / observations.length).toFixed(2)),
      mean_elapsed_seconds: Number((observations.reduce((sum, item) => sum + item.measurement.elapsed_seconds, 0) / observations.length).toFixed(2)),
      mean_misconception_recurrence: Number((observations.reduce((sum, item) => sum + item.measurement.misconception_recurrence, 0) / observations.length).toFixed(2)),
      mean_calibration_error: Number((observations.reduce((sum, item) => sum + item.measurement.calibration_error, 0) / observations.length).toFixed(3))
    };
    const delayedSuccess = metrics.delayed_retention !== null && metrics.delayed_retention >= 0.67 && guardrails.access_barrier_rate <= 0.1;
    findings.push({
      finding_id: `fnd_${digest({ mechanism, metrics, guardrails }).slice(0, 16)}`,
      mechanism,
      component: observations[0].component,
      direction: delayedSuccess ? "went_well" : "needs_improvement",
      cohort_size: subjects.size,
      observation_count: observations.length,
      metrics,
      guardrails,
      confidence: subjects.size >= 20 ? "moderate" : "low",
      uncertainty: subjects.size >= 20 ? "observational; plausible confounding remains" : "small synthetic cohort; direction is a pipeline test, not an efficacy claim",
      provenance: [...new Set(observations.flatMap((item) => Object.values(item.versions)))].sort()
    });
  }
  return { schema: "tutor.feedback-analysis/v1", synthetic: true, minimum_cohort: minimumCohort, findings };
}

function assertPublicPayload(payload) {
  const allowed = new Set(["title", "body", "labels"]);
  if (!payload || typeof payload !== "object" || Object.keys(payload).some((key) => !allowed.has(key))) throw new FeedbackError("unsafe_issue", "Issue payload has unreviewed fields");
  if (typeof payload.title !== "string" || typeof payload.body !== "string" || !Array.isArray(payload.labels)) throw new FeedbackError("unsafe_issue", "Issue payload shape is invalid");
  if (SENSITIVE_TEXT.test(`${payload.title}\n${payload.body}`) || /transcript|verbatim|learner|participant|subject_ref|\b(?:sub|ctl|rec)_[a-z0-9_-]+\b/i.test(payload.body)) throw new FeedbackError("disclosure_risk", "Issue payload contains private-source language or identifiers");
  if (payload.labels.some((label) => !ISSUE_LABELS.has(label))) throw new FeedbackError("unsafe_label", "Issue label is not allowlisted");
  return payload;
}

export function createIssueDraft(finding) {
  if (!finding || finding.cohort_size < 3 || !["went_well", "needs_improvement"].includes(finding.direction)) throw new FeedbackError("unsafe_finding", "Finding is not disclosure-safe");
  const direction = finding.direction === "went_well" ? "preserve effective pattern" : "improve delayed learning pattern";
  const body = [
    "## Synthetic finding",
    `The synthetic validation pipeline indicates **${direction}** for mechanism \`${finding.mechanism}\` in \`${finding.component}\`.`,
    "",
    "## Learning and guardrail signals",
    `- Immediate performance: ${finding.metrics.immediate_performance ?? "not measured"}`,
    `- Delayed retention: ${finding.metrics.delayed_retention ?? "not measured"}`,
    `- Transfer: ${finding.metrics.transfer ?? "not measured"}`,
    `- Mean opportunities: ${finding.metrics.mean_opportunities}`,
    `- Misconception recurrence / calibration error: ${finding.metrics.mean_misconception_recurrence}/${finding.metrics.mean_calibration_error}`,
    `- Stop/access-barrier/too-hard rates: ${finding.guardrails.stop_rate}/${finding.guardrails.access_barrier_rate}/${finding.guardrails.too_hard_rate}`,
    "",
    "## Interpretation",
    `${finding.uncertainty}. This observational synthetic result does not establish causality. Plausible confounders include starting level, task difficulty, accessibility fit, and measurement timing.`,
    "",
    "## Expected learning impact",
    "Improve durable mastery per opportunity while holding stopping, accessibility, excessive challenge, and hint-dependence guardrails.",
    "",
    "## Synthetic reproduction",
    `Run dataset \`syn_feedback_v1\` through measurement versions ${finding.provenance.map((item) => `\`${item}\``).join(", ")} and compare immediate, delayed-retention, transfer, and guardrail outputs.`,
    "",
    `Private audit link: \`${finding.finding_id}\` (contains no source records).`
  ].join("\n");
  return Object.freeze(assertPublicPayload({
    title: `[Learning efficacy] ${direction}: ${finding.mechanism}`,
    body,
    labels: ["learning-efficacy", "privacy-reviewed-draft", "synthetic-evidence"]
  }));
}

export function prepareExactPayload(issueDraft) {
  const payload = stable(assertPublicPayload(issueDraft));
  const payloadDigest = digest(payload);
  return Object.freeze({ payload, payloadDigest, confirmation: `Confirm external GitHub issue payload sha256:${payloadDigest}` });
}

export async function sendExactlyConfirmed({ prepared, confirmedDigest, confirmedPayload, writer }) {
  if (!prepared || confirmedDigest !== prepared.payloadDigest || canonical(confirmedPayload) !== canonical(prepared.payload)) {
    throw new FeedbackError("exact_confirmation_required", "External write requires confirmation of these exact bytes");
  }
  assertPublicPayload(confirmedPayload);
  if (typeof writer !== "function") throw new FeedbackError("writer_required", "An authorized issue writer is required");
  return writer(stable(confirmedPayload));
}
