import { createHash } from "node:crypto";
import { deriveReadiness } from "../../../packages/learning-state/src/index.js";
import { createGenerationSlice, generateCurriculum } from "../curricula/index.js";
import { decideTutorAction } from "../orchestrator/index.js";

const ID = /^[a-z][a-z0-9_.:-]{2,127}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const PERSONAS = new Set(["age-11", "adult", "caregiver-mediated"]);
const FORBIDDEN_PRIVATE_KEYS = new Set(["name", "email", "phone", "address", "date_of_birth", "birthdate", "diagnosis", "raw_transcript", "transcript", "history"]);
const SOURCE_FIELDS = new Set(["source_id", "title", "url", "digest", "review_status"]);

export class SessionPlanningError extends Error {
  constructor(code, message) { super(message); this.name = "SessionPlanningError"; this.code = code; }
}

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const containsPrivateKey = (value) => Array.isArray(value)
  ? value.some(containsPrivateKey)
  : value && typeof value === "object"
    ? Object.entries(value).some(([key, child]) => FORBIDDEN_PRIVATE_KEYS.has(key.toLowerCase()) || containsPrivateKey(child))
    : false;

function validateGrounding(value) {
  if (value?.schema !== "tutor.grounded-subject/v1") throw new SessionPlanningError("invalid_grounding", "A versioned grounded subject packet is required");
  if (containsPrivateKey(value)) throw new SessionPlanningError("private_grounding", "Grounding must not contain identity, diagnosis, history, or transcript data");
  for (const [field, candidate] of [["subject_id", value.subject_id], ["outcome_id", value.goal?.outcome_id], ["context_id", value.goal?.context_id], ["user_ref", value.learner?.user_ref], ["profile_version", value.learner?.profile_version]]) {
    if (!ID.test(candidate ?? "")) throw new SessionPlanningError("invalid_grounding", `${field} must be a safe opaque ID`);
  }
  if (typeof value.subject_label !== "string" || !value.subject_label.trim() || value.subject_label.length > 80) throw new SessionPlanningError("invalid_grounding", "Subject label is required");
  if (typeof value.goal?.label !== "string" || !value.goal.label.trim() || value.goal.label.length > 160) throw new SessionPlanningError("invalid_grounding", "A bounded goal label is required");
  if (!PERSONAS.has(value.learner?.persona)) throw new SessionPlanningError("invalid_grounding", "A supported learner persona is required");
  if (!Array.isArray(value.learner?.accessible_routes) || !value.learner.accessible_routes.length || value.learner.accessible_routes.some((route) => !ID.test(route))) throw new SessionPlanningError("invalid_grounding", "At least one safe accessible route is required");
  if (value.safety_review !== "approved_for_synthetic_session") throw new SessionPlanningError("safety_review_required", "Synthetic-session safety review is required");
  if (!Array.isArray(value.sources) || !value.sources.length || value.sources.length > 8) throw new SessionPlanningError("source_required", "One to eight approved sources are required");
  for (const source of value.sources) {
    if (Object.keys(source ?? {}).some((field) => !SOURCE_FIELDS.has(field))) throw new SessionPlanningError("source_unapproved", "Source packets may contain citation metadata only");
    if (!ID.test(source?.source_id ?? "") || source.review_status !== "approved_for_session" || !HASH.test(source.digest ?? "")) throw new SessionPlanningError("source_unapproved", "Every source requires a safe ID, digest, and session approval");
    let url;
    try { url = new URL(source.url); } catch { throw new SessionPlanningError("source_unapproved", "Every source requires an HTTPS URL"); }
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new SessionPlanningError("source_unapproved", "Every source requires a clean HTTPS URL");
    if (typeof source.title !== "string" || !source.title.trim() || source.title.length > 160) throw new SessionPlanningError("source_unapproved", "Every source requires a bounded title");
  }
  if (!Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 24) throw new SessionPlanningError("invalid_grounding", "One to twenty-four curriculum nodes are required");
  return structuredClone(value);
}

function unseenProjection(curriculum, graph) {
  return {
    schema: "tutor.learning-projection/v1", algorithm_version: "explicit_rules_v1",
    projection_version: `prj_${digest({ graph: graph.graph_id, state: "unseen" }).slice(0, 16)}`,
    user_id: curriculum.user_id, curriculum_id: curriculum.curriculum_id, graph_id: graph.graph_id,
    nodes: Object.fromEntries(graph.nodes.map((node) => [node.node_id, {
      node_id: node.node_id, state: "unseen", confidence: 0, reasons: ["no_observation"], next_check_at: null
    }]))
  };
}

export function planGroundedSession(value, { now = new Date().toISOString() } = {}) {
  const packet = validateGrounding(value);
  const sourceDigest = `sha256:${digest({ sources: packet.sources, nodes: packet.nodes })}`;
  const template = {
    template_id: `tpl_${digest({ subject: packet.subject_id, sourceDigest }).slice(0, 16)}`,
    review_status: "approved", source_ids: packet.sources.map((source) => source.source_id), source_digest: sourceDigest,
    subject_label: packet.subject_label, goal_labels: { [packet.goal.outcome_id]: packet.goal.label },
    target_horizon: "open", nodes: packet.nodes
  };
  const profile = {
    user_ref: packet.learner.user_ref, profile_version: packet.learner.profile_version,
    age_band: packet.learner.persona, goals: [{ subject_id: packet.subject_id, outcome_id: packet.goal.outcome_id, context_id: packet.goal.context_id }],
    access: { output_routes: packet.learner.accessible_routes, supports: [] }
  };
  const result = generateCurriculum({ request: createGenerationSlice(profile, packet.subject_id), registry: new Map([[packet.subject_id, template]]), now });
  if (result.status !== "generated") throw new SessionPlanningError("curriculum_rejected", "Grounded curriculum did not pass graph validation");
  const projection = unseenProjection(result.curriculum, result.graph);
  const expected = Object.fromEntries(result.graph.nodes.map((node) => [node.node_id, node.importance === "required" ? 0.8 : 0.5]));
  const accessFit = Object.fromEntries(result.graph.nodes.map((node) => [node.node_id, 1]));
  const readiness = deriveReadiness({
    graph: result.graph, projection, now: Date.parse(now), goal_path_ids: result.graph.nodes.filter((node) => node.importance === "required").map((node) => node.node_id),
    expected_learning_value: expected, access_fit: accessFit
  });
  const versions = digest({ graph: result.graph.graph_id, sources: sourceDigest }).slice(0, 16);
  const candidates = readiness.ranked_candidates.map((nodeId) => {
    const node = result.graph.nodes.find((item) => item.node_id === nodeId);
    return {
      node_id: nodeId, ready: true, safety_allowed: true, access_fit: true, verification_due: false,
      expected_learning_value: expected[nodeId], goal_path: node.importance === "required" ? 1 : 0,
      prerequisite_leverage: result.graph.nodes.filter((item) => item.requirements.some((clause) => clause.any_of.includes(nodeId))).length,
      uncertainty_reduction: 1, flow_fit: 0.5, rubric_version: `rub_${versions}`, content_version: `con_${versions}`,
      access_route: node.accessible_routes[0]
    };
  });
  const decision = decideTutorAction({
    schema: "tutor.orchestration-input/v1", authority: { decision: "allow" }, control: {},
    graph_id: result.graph.graph_id, projection_version: projection.projection_version,
    ephemeral_profile_ref: `eph_${digest({ user: packet.learner.user_ref, now }).slice(0, 16)}`, candidates, recent: {}
  });
  const selected = result.graph.nodes.find((node) => node.node_id === decision.objective?.node_id);
  return stable({
    schema: "tutor.grounded-session-plan/v1", curriculum: result.curriculum, graph: result.graph,
    projection, readiness, decision,
    activity_brief: selected ? {
      node_id: selected.node_id, label: selected.label, outcome: selected.outcome,
      mechanisms: selected.activity_mechanisms, persona: packet.learner.persona,
      source_ids: packet.sources.map((source) => source.source_id), content_version: decision.objective.content_version,
      rubric_version: decision.objective.rubric_version
    } : null,
    source_provenance: packet.sources.map(({ source_id, title, url, digest: sourceHash }) => ({ source_id, title, url, digest: sourceHash }))
  });
}
