const ID = /^[a-z][a-z0-9_.:-]{2,127}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const STATES = new Set(["active", "archived"]);
const IMPORTANCE = new Set(["required", "optional", "enrichment"]);
const EVIDENCE_GRADES = new Set(["observation", "provisional", "retained", "transfer"]);
const PRIVACY_CLASSES = new Set(["ephemeral", "learning_record", "sensitive"]);
const OBSERVATION_FIELDS = new Set(["correct", "score", "misconception_ids", "latency_ms", "attempt_count", "novel_context"]);
const CHANGE_OPERATIONS = new Set(["add", "supersede", "archive", "split", "merge", "change_requirement", "change_route", "change_goal"]);
const PRIVATE_KEYS = new Set(["name", "full_name", "email", "phone", "address", "birthdate", "date_of_birth", "diagnosis", "transcript", "raw_transcript", "path", "file_path", "workspace_path"]);
const LIMITS = Object.freeze({ parents: 8, nodes: 2048, clausesPerNode: 32, alternativesPerClause: 16, list: 64, changes: 256, criteria: 64, levels: 16 });

export class CurriculumValidationError extends Error {
  constructor(errors) {
    super(`Curriculum validation failed: ${errors.join("; ")}`);
    this.name = "CurriculumValidationError";
    this.errors = errors;
  }
}

export const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
export const isSafeId = (value) => typeof value === "string" && ID.test(value);
const bounded = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isoTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

function containsPrivateKey(value) {
  if (Array.isArray(value)) return value.some(containsPrivateKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => PRIVATE_KEYS.has(key.toLowerCase()) || containsPrivateKey(child));
}

function finish(value, errors) {
  if (containsPrivateKey(value)) errors.push("private identity, diagnosis, and transcript fields are forbidden");
  if (errors.length) throw new CurriculumValidationError([...new Set(errors)]);
  return Object.freeze(structuredClone(value));
}

export function validateCurriculum(value) {
  const errors = [];
  if (!isRecord(value)) throw new CurriculumValidationError(["curriculum must be an object"]);
  if (value.schema !== "tutor.curriculum/v1") errors.push("unsupported curriculum schema");
  for (const field of ["curriculum_id", "user_id", "graph_version"]) if (!isSafeId(value[field])) errors.push(`${field} must be a safe opaque ID`);
  if (!isRecord(value.subject) || !isSafeId(value.subject.id) || !bounded(value.subject.label, 160)) errors.push("subject requires a stable ID and bounded label");
  if (!isRecord(value.goal) || !bounded(value.goal.statement, 500) || !bounded(value.goal.target_horizon, 80)) errors.push("goal statement and target horizon are required");
  if (!STATES.has(value.status)) errors.push("curriculum status must be active or archived");
  if (!isRecord(value.generated_from) || !Array.isArray(value.generated_from.sources) || !value.generated_from.sources.length || value.generated_from.sources.some((source) => !isSafeId(source))) errors.push("approved source provenance is required");
  if (!isSafeId(value.generated_from?.profile_head)) errors.push("generated_from.profile_head must be an opaque versioned ID");
  if (value.generated_from?.diagnostic_event_set && !HASH.test(value.generated_from.diagnostic_event_set)) errors.push("diagnostic event set must be a sha256 digest");
  if (!isoTime(value.created_at)) errors.push("created_at must be an ISO timestamp");
  return finish(value, errors);
}

function validateEvidenceContract(contract, path, errors) {
  if (!isRecord(contract)) { errors.push(`${path} evidence contract is required`); return; }
  for (const grade of ["provisional", "retained", "transfer"]) {
    if (!Array.isArray(contract[grade]) || !contract[grade].length || contract[grade].some((item) => !isSafeId(item))) errors.push(`${path}.${grade} requires bounded evidence rule IDs`);
  }
}

export function validateGraph(value, { curriculumId } = {}) {
  const errors = [];
  if (!isRecord(value)) throw new CurriculumValidationError(["graph must be an object"]);
  if (value.schema !== "tutor.curriculum-graph/v1") errors.push("unsupported graph schema");
  if (!isSafeId(value.graph_id) || !isSafeId(value.curriculum_id)) errors.push("graph and curriculum IDs must be safe");
  if (curriculumId && value.curriculum_id !== curriculumId) errors.push("graph does not belong to the expected curriculum");
  if (!Array.isArray(value.parents) || value.parents.length > LIMITS.parents || value.parents.some((id) => !isSafeId(id)) || new Set(value.parents).size !== value.parents.length) errors.push("parents must be a bounded list of unique safe graph IDs");
  if (value.parents?.includes(value.graph_id)) errors.push("graph cannot be its own parent");
  if (!Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > LIMITS.nodes) errors.push("graph requires a bounded node list");
  const nodeIds = new Set();
  const clauseIds = new Set();
  for (const [index, node] of (value.nodes ?? []).entries()) {
    const path = `nodes[${index}]`;
    if (!isRecord(node) || !isSafeId(node.node_id)) { errors.push(`${path} requires a safe node ID`); continue; }
    if (nodeIds.has(node.node_id)) errors.push(`duplicate node ID ${node.node_id}`); nodeIds.add(node.node_id);
    if (node.kind !== "capability" || !bounded(node.label, 160) || !bounded(node.outcome, 500)) errors.push(`${path} requires capability kind, label, and observable outcome`);
    if (!IMPORTANCE.has(node.importance) || !STATES.has(node.status)) errors.push(`${path} has invalid importance or status`);
    validateEvidenceContract(node.evidence_contract, path, errors);
    for (const field of ["misconception_ids", "activity_mechanisms", "provenance", "accessible_routes"]) if (!Array.isArray(node[field]) || node[field].length > LIMITS.list || (field !== "misconception_ids" && !node[field].length) || node[field].some((id) => !isSafeId(id)) || new Set(node[field]).size !== node[field].length) errors.push(`${path}.${field} must contain bounded unique safe IDs`);
    if (!Array.isArray(node.requirements) || node.requirements.length > LIMITS.clausesPerNode) errors.push(`${path}.requirements must be a bounded array`);
    for (const clause of node.requirements ?? []) {
      if (!isRecord(clause) || !isSafeId(clause.clause_id) || !Array.isArray(clause.any_of) || !clause.any_of.length || clause.any_of.length > LIMITS.alternativesPerClause || clause.any_of.some((id) => !isSafeId(id))) errors.push(`${path} has an invalid or oversized requirement clause`);
      else { if (clauseIds.has(clause.clause_id)) errors.push(`duplicate clause ID ${clause.clause_id}`); clauseIds.add(clause.clause_id); }
    }
  }
  const waiverIds = new Set();
  for (const waiver of value.waivers ?? []) {
    if (!isRecord(waiver) || !isSafeId(waiver.waiver_id) || !isSafeId(waiver.clause_id) || !bounded(waiver.authority, 120) || !isSafeId(waiver.evidence_event_id) || !isoTime(waiver.expires_at)) errors.push("waiver requires identity, scoped clause, authority, evidence, and expiry");
    else { if (waiverIds.has(waiver.waiver_id)) errors.push(`duplicate waiver ID ${waiver.waiver_id}`); waiverIds.add(waiver.waiver_id); if (!clauseIds.has(waiver.clause_id)) errors.push(`waiver ${waiver.waiver_id} references unknown clause`); }
  }
  const waiverById = new Map((value.waivers ?? []).map((waiver) => [waiver.waiver_id, waiver]));
  for (const node of value.nodes ?? []) for (const clause of node.requirements ?? []) for (const member of clause.any_of ?? []) {
    if (!nodeIds.has(member) && !waiverIds.has(member)) errors.push(`requirement member ${member} is unknown`);
    if (waiverById.has(member) && waiverById.get(member).clause_id !== clause.clause_id) errors.push(`waiver ${member} is outside its scoped clause`);
  }
  if (!isoTime(value.created_at)) errors.push("created_at must be an ISO timestamp");
  for (const waiver of value.waivers ?? []) if (isoTime(waiver.expires_at) && isoTime(value.created_at) && Date.parse(waiver.expires_at) <= Date.parse(value.created_at)) errors.push(`waiver ${waiver.waiver_id} must expire after graph creation`);
  return finish(value, errors);
}

export function validateEvidenceEvent(value) {
  const errors = [];
  if (!isRecord(value)) throw new CurriculumValidationError(["evidence event must be an object"]);
  if (value.schema !== "tutor.evidence-event/v1") errors.push("unsupported evidence schema");
  for (const field of ["event_id", "user_id", "curriculum_id", "graph_id", "node_id", "objective_id", "item_version", "rubric_version", "assistant_version", "algorithm_version"]) if (!isSafeId(value[field])) errors.push(`${field} must be a safe versioned ID`);
  if (!EVIDENCE_GRADES.has(value.grade)) errors.push("invalid evidence grade");
  if (!isRecord(value.observation) || typeof value.observation.correct !== "boolean") errors.push("structured observation.correct is required");
  if (isRecord(value.observation)) {
    const unknown = Object.keys(value.observation).filter((field) => !OBSERVATION_FIELDS.has(field));
    if (unknown.length) errors.push(`observation contains non-structured fields: ${unknown.join(", ")}`);
    if (value.observation.misconception_ids && (!Array.isArray(value.observation.misconception_ids) || value.observation.misconception_ids.some((id) => !isSafeId(id)))) errors.push("observation misconception IDs are invalid");
  }
  if (!isRecord(value.support) || !bounded(value.support.scaffold, 80) || !Number.isInteger(value.support.help_count) || value.support.help_count < 0) errors.push("support scaffold and help count are required");
  if (!isRecord(value.uncertainty) || typeof value.uncertainty.confidence !== "number" || value.uncertainty.confidence < 0 || value.uncertainty.confidence > 1) errors.push("uncertainty confidence must be from zero to one");
  if (!isRecord(value.privacy) || !PRIVACY_CLASSES.has(value.privacy.class) || !isSafeId(value.privacy.purpose)) errors.push("known privacy class and purpose ID are required");
  if (!Array.isArray(value.provenance) || !value.provenance.length || value.provenance.some((id) => !isSafeId(id))) errors.push("evidence provenance is required");
  if (!isoTime(value.observed_at)) errors.push("observed_at must be an ISO timestamp");
  return finish(value, errors);
}

export function validateRubric(value) {
  const errors = [];
  if (!isRecord(value) || value.schema !== "tutor.rubric/v1") errors.push("unsupported rubric schema");
  for (const field of ["rubric_id", "version", "objective_id"]) if (!isSafeId(value?.[field])) errors.push(`${field} must be a safe versioned ID`);
  if (!Array.isArray(value?.criteria) || !value.criteria.length || value.criteria.length > LIMITS.criteria) errors.push("rubric requires bounded criteria");
  const ids = new Set();
  for (const criterion of value?.criteria ?? []) {
    if (!isRecord(criterion) || !isSafeId(criterion.criterion_id) || !bounded(criterion.description, 500) || !Array.isArray(criterion.levels) || criterion.levels.length < 2 || criterion.levels.length > LIMITS.levels || criterion.levels.some((level) => !isRecord(level) || !isSafeId(level.level_id) || !bounded(level.description, 500))) errors.push("each criterion requires an ID, description, and two to sixteen bounded levels");
    else { if (ids.has(criterion.criterion_id)) errors.push(`duplicate criterion ID ${criterion.criterion_id}`); ids.add(criterion.criterion_id); }
  }
  if (!Array.isArray(value?.accessible_routes) || !value.accessible_routes.length || value.accessible_routes.some((id) => !isSafeId(id))) errors.push("rubric requires accessible evidence routes");
  if (!Array.isArray(value?.provenance) || !value.provenance.length || value.provenance.some((id) => !isSafeId(id))) errors.push("rubric provenance is required");
  return finish(value, errors);
}

export function validateMisconception(value) {
  const errors = [];
  if (!isRecord(value) || value.schema !== "tutor.misconception/v1") errors.push("unsupported misconception schema");
  if (!isSafeId(value?.misconception_id) || !isSafeId(value?.objective_id)) errors.push("misconception and objective IDs are required");
  if (!bounded(value?.description, 500) || !bounded(value?.observable_pattern, 500)) errors.push("misconception requires bounded description and observable pattern");
  if (!Array.isArray(value?.counter_evidence) || !value.counter_evidence.length || value.counter_evidence.some((id) => !isSafeId(id))) errors.push("counter-evidence rule IDs are required");
  if (!Array.isArray(value?.provenance) || !value.provenance.length || value.provenance.some((id) => !isSafeId(id))) errors.push("misconception provenance is required");
  return finish(value, errors);
}

export function validateChangeSet(value) {
  const errors = [];
  if (!isRecord(value) || value.schema !== "tutor.curriculum-change-set/v1") errors.push("unsupported change-set schema");
  for (const field of ["change_set_id", "curriculum_id", "from_graph_id", "to_graph_id"]) if (!isSafeId(value?.[field])) errors.push(`${field} must be a safe ID`);
  if (value?.from_graph_id === value?.to_graph_id) errors.push("change set must publish a new graph version");
  if (!Array.isArray(value?.changes) || !value.changes.length || value.changes.length > LIMITS.changes) errors.push("change set requires a bounded change list");
  for (const change of value?.changes ?? []) {
    if (!isRecord(change) || !CHANGE_OPERATIONS.has(change.operation) || !Array.isArray(change.from) || !Array.isArray(change.to) || [...change.from, ...change.to].some((id) => !isSafeId(id))) errors.push("change operation requires valid from/to node IDs");
    if (["supersede", "split", "merge"].includes(change?.operation) && (!change.from.length || !change.to.length || !bounded(change.rationale, 500) || typeof change.confidence !== "number" || change.confidence < 0 || change.confidence > 1)) errors.push("semantic mappings require endpoints, rationale, and confidence");
    if (change?.operation === "supersede" && change.from.some((id) => change.to.includes(id))) errors.push("materially superseded outcomes require new node IDs");
    if (change?.operation === "add" && (change.from.length || !change.to.length)) errors.push("add requires only destination nodes");
    if (change?.operation === "archive" && (!change.from.length || change.to.length)) errors.push("archive requires only source nodes");
    if (change?.operation === "split" && (change.from.length !== 1 || change.to.length < 2)) errors.push("split requires one source and multiple destinations");
    if (change?.operation === "merge" && (change.from.length < 2 || change.to.length !== 1)) errors.push("merge requires multiple sources and one destination");
  }
  return finish(value, errors);
}
