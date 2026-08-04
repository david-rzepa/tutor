import { createHash } from "node:crypto";

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ALLOWED_CAPABILITIES = new Set(["attempt.recorded", "adaptation.requested", "agent.requested", "session.ready", "session.stopped"]);
const JUDGMENT_GATES = ["answerability", "rubric_consistency", "factual_grounding", "level_fit", "bias_safety", "construct_equivalence"];
const JUDGMENT_STATUS = new Set(["pass", "fail", "uncertain"]);
const RATIONALE_CODES = new Set(["answerable", "unanswerable", "rubric_consistent", "rubric_inconsistent", "grounded", "unsupported", "level_fit", "level_mismatch", "neutral", "bias_risk", "equivalent", "construct_changed", "insufficient_evidence", "timeout"]);
const PRIVATE = /(transcript|raw_response|learner_name|display_name|email|phone|address|diagnosis|secret|token|password|stable_user|user_id)/i;
const SENSITIVE = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:sk|ghp|github_pat)_[a-z0-9_-]{8,}|\busr_[a-z0-9_-]+\b)/i;
const ESCAPE = /\b(?:fetch|WebSocket|XMLHttpRequest|eval|Function|localStorage|sessionStorage)\b|document\.cookie|window\.(?:parent|top)|<script[^>]+src\s*=/i;

export class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function digest(value) {
  const content = typeof value === "string" ? value : JSON.stringify(stable(value ?? null));
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function finding(gate, code, message, severity = "error") {
  return { gate, code, message, severity };
}

function scanPrivate(value, trail, findings) {
  if (typeof value === "string") {
    if (SENSITIVE.test(value)) findings.push(finding("privacy", "sensitive_content", `${trail} contains a private or secret pattern`));
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry, index) => scanPrivate(entry, `${trail}[${index}]`, findings));
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE.test(key)) findings.push(finding("privacy", "private_field", `${trail}.${key} is not permitted`));
    scanPrivate(entry, `${trail}.${key}`, findings);
  }
}

function checkProvenance(candidate, findings) {
  const provenance = candidate.provenance;
  if (!provenance || typeof provenance !== "object") {
    findings.push(finding("provenance", "missing_provenance", "Version and digest provenance is required"));
    return;
  }
  for (const key of ["curriculum_version", "content_version", "rubric_version", "model_version"]) {
    if (!ID.test(provenance[key])) findings.push(finding("provenance", "missing_version", `${key} is required`));
  }
  for (const key of ["curriculum_digest", "content_digest", "rubric_digest", "model_digest"]) {
    if (!DIGEST.test(provenance[key])) findings.push(finding("provenance", "missing_digest", `${key} requires a SHA-256 digest`));
  }
}

function deterministic(candidate) {
  const findings = [];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [finding("schema", "invalid_candidate", "Candidate must be an object")];
  if (candidate.schema !== "tutor.activity-candidate/v1") findings.push(finding("schema", "unknown_schema", "Known activity schema major is required"));
  if (!ID.test(candidate.activity_id)) findings.push(finding("schema", "invalid_activity_id", "Opaque activity ID is required"));
  checkProvenance(candidate, findings);
  scanPrivate(candidate, "candidate", findings);

  const objective = candidate.objective;
  if (!objective || !["node_id", "operation", "construct"].every((key) => ID.test(objective?.[key]))) {
    findings.push(finding("alignment", "invalid_objective", "Curriculum node, mental operation, and construct are required"));
  }
  if (candidate.item?.node_id !== objective?.node_id) findings.push(finding("alignment", "node_mismatch", "Item does not align to the curriculum node"));
  if (candidate.item?.operation !== objective?.operation) findings.push(finding("alignment", "operation_mismatch", "Item does not elicit the intended mental operation"));

  const options = candidate.item?.options;
  const optionIds = Array.isArray(options) ? options.map((option) => option?.id) : [];
  if (!Array.isArray(options) || options.length < 2 || options.length > 8 || optionIds.some((id) => !ID.test(id)) || new Set(optionIds).size !== optionIds.length) {
    findings.push(finding("answerability", "invalid_options", "Two to eight unique answer options are required"));
  }
  if (!optionIds.includes(candidate.item?.answer_id)) findings.push(finding("answerability", "wrong_key", "Answer key must reference an available option"));
  const answerLabel = options?.find((option) => option.id === candidate.item?.answer_id)?.label;
  if (answerLabel && String(candidate.item?.prompt).toLocaleLowerCase().includes(String(answerLabel).toLocaleLowerCase())) {
    findings.push(finding("leakage", "answer_leak", "Prompt reveals the keyed answer"));
  }
  if (candidate.item?.rubric_version !== candidate.provenance?.rubric_version) findings.push(finding("rubric", "rubric_mismatch", "Item and provenance rubric versions differ"));
  if (!candidate.feedback?.actionable_retry || candidate.feedback?.reveals_before_attempt) findings.push(finding("pedagogy", "invalid_feedback", "Feedback must create a retry without revealing before an attempt"));
  if (candidate.claims?.some((claim) => !ID.test(claim.source_id) || !candidate.approved_sources?.includes(claim.source_id))) {
    findings.push(finding("grounding", "unsupported_claim", "Every factual claim requires an approved source"));
  }

  const routes = candidate.accessibility?.routes;
  if (!Array.isArray(routes) || routes.length === 0 || routes.some((route) => route.construct !== objective?.construct || !route.semantic || route.timed)) {
    findings.push(finding("accessibility", "construct_or_access_mismatch", "Every route must preserve the construct, be semantic, and avoid timing pressure"));
  }
  if (!candidate.accessibility?.keyboard || !candidate.accessibility?.screen_reader_status || !candidate.accessibility?.reduced_motion) {
    findings.push(finding("accessibility", "missing_access_support", "Keyboard, status announcement, and reduced-motion support are required"));
  }
  if (!candidate.safety?.stop_visible || !candidate.safety?.correction_path || candidate.safety?.external_links || candidate.safety?.open_generation) {
    findings.push(finding("safety", "unsafe_interaction", "Visible stop/correction and closed content bounds are required"));
  }
  if (candidate.protocol?.version !== "tutor.assistant/v1" || candidate.protocol?.sandbox !== "opaque-origin" || candidate.protocol?.network !== false) {
    findings.push(finding("sandbox", "protocol_escape", "Reviewed protocol, opaque origin, and no network are required"));
  }
  if (!Array.isArray(candidate.protocol?.capabilities) || candidate.protocol.capabilities.some((capability) => !ALLOWED_CAPABILITIES.has(capability))) {
    findings.push(finding("sandbox", "capability_escape", "Activity requests an undeclared capability"));
  }
  if (candidate.application_code && ESCAPE.test(candidate.application_code)) findings.push(finding("sandbox", "code_escape", "Generated code attempts an ambient capability"));
  const budget = candidate.budget;
  if (!budget || budget.files > 6 || budget.bytes > 64 * 1024 || budget.ui_states > 12 || budget.agent_callbacks > 2 || budget.build_ms > 2_000) {
    findings.push(finding("budget", "construction_budget", "Activity exceeds the reviewed construction budget"));
  }
  return findings;
}

function validateFallback(fallback) {
  return fallback && ID.test(fallback.id) && fallback.review_status === "approved" && DIGEST.test(fallback.digest);
}

async function boundedJudgments(candidate, judge, timeoutMs) {
  if (typeof judge !== "function") return JUDGMENT_GATES.map((gate) => ({ gate, status: "uncertain", confidence: 0, rationale_code: "insufficient_evidence", model_version: candidate.provenance?.model_version ?? "unknown" }));
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); });
  let result;
  try {
    result = await Promise.race([Promise.resolve().then(() => judge(stable(candidate))).catch(() => "invalid"), timeout]);
  } finally {
    clearTimeout(timer);
  }
  if (result === "timeout") return JUDGMENT_GATES.map((gate) => ({ gate, status: "uncertain", confidence: 0, rationale_code: "timeout", model_version: candidate.provenance.model_version }));
  if (!Array.isArray(result)) return JUDGMENT_GATES.map((gate) => ({ gate, status: "uncertain", confidence: 0, rationale_code: "insufficient_evidence", model_version: candidate.provenance.model_version }));
  const byGate = new Map(result.map((entry) => [entry?.gate, entry]));
  return JUDGMENT_GATES.map((gate) => {
    const entry = byGate.get(gate);
    if (!entry || !JUDGMENT_STATUS.has(entry.status) || !Number.isFinite(entry.confidence) || entry.confidence < 0 || entry.confidence > 1 || !RATIONALE_CODES.has(entry.rationale_code) || !ID.test(entry.model_version)) {
      return { gate, status: "uncertain", confidence: 0, rationale_code: "insufficient_evidence", model_version: candidate.provenance.model_version };
    }
    return stable({ gate, status: entry.status, confidence: entry.confidence, rationale_code: entry.rationale_code, model_version: entry.model_version });
  });
}

export async function validateActivity(candidate, { judge, timeoutMs = 500, fallback = null } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new ValidationError("invalid_timeout", "Timeout must be bounded");
  const deterministicFindings = deterministic(candidate);
  const judgments = deterministicFindings.length ? [] : await boundedJudgments(candidate, judge, timeoutMs);
  const judgmentFailed = judgments.some((entry) => entry.status === "fail");
  const judgmentUncertain = judgments.some((entry) => entry.status === "uncertain");
  const humanReview = judgmentFailed || judgmentUncertain;
  const passed = deterministicFindings.length === 0 && !humanReview;
  let publication;
  if (passed) publication = { action: "publish", artifact_id: candidate.activity_id };
  else if (validateFallback(fallback)) publication = { action: "fallback", artifact_id: fallback.id, digest: fallback.digest };
  else publication = { action: "stop", reason: "no_reviewed_safe_artifact" };
  const report = {
    schema: "tutor.activity-validation/v1",
    validator_version: "activity_validation_v1",
    candidate_id: ID.test(candidate?.activity_id) ? candidate.activity_id : "invalid_candidate",
    candidate_digest: digest(candidate),
    provenance: stable(candidate?.provenance ?? {}),
    deterministic: { passed: deterministicFindings.length === 0, findings: deterministicFindings },
    judgments,
    uncertainty: judgmentUncertain ? "bounded judgment incomplete; not proof of correctness" : judgmentFailed ? "bounded judgment found a reviewed risk" : null,
    human_review_required: humanReview,
    passed,
    publication
  };
  return Object.freeze(stable(report));
}
