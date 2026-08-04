import { createHash } from "node:crypto";
import { validateChangeSet, validateCurriculum, validateGraphStructure } from "../../../packages/curriculum-model/src/index.js";

const ID = /^[a-z][a-z0-9_.:-]{2,127}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

export class CurriculumServiceError extends Error {
  constructor(code, message) { super(message); this.name = "CurriculumServiceError"; this.code = code; }
}

const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const assertId = (value, field) => { if (!ID.test(value)) throw new CurriculumServiceError("invalid_id", `${field} must be an opaque ID`); };

export function createGenerationSlice(profile, subjectId) {
  assertId(subjectId, "subjectId");
  const goal = profile?.goals?.find((entry) => entry.subject_id === subjectId);
  if (!goal) throw new CurriculumServiceError("goal_not_found", "Profile has no goal for the requested subject");
  return stable({
    schema: "tutor.curriculum-generation-slice/v1", user_ref: profile.user_ref,
    profile_version: profile.profile_version, subject_id: subjectId,
    goal: { outcome_id: goal.outcome_id, context_id: goal.context_id },
    age_band: profile.age_band,
    accessible_routes: [...new Set([...(profile.access?.output_routes ?? []), ...(profile.access?.supports ?? [])])].sort()
  });
}

export function correctGenerationSlice(request, correction) {
  if (request?.schema !== "tutor.curriculum-generation-slice/v1" || correction?.authorized !== true) throw new CurriculumServiceError("correction_denied", "An authorized minimized correction is required");
  const allowed = new Set(["authorized", "outcome_id", "context_id", "accessible_routes"]);
  if (Object.keys(correction).some((key) => !allowed.has(key))) throw new CurriculumServiceError("correction_scope", "Correction contains profile history or an unsupported field");
  const next = structuredClone(request);
  if (correction.outcome_id) { assertId(correction.outcome_id, "outcome_id"); next.goal.outcome_id = correction.outcome_id; }
  if (correction.context_id) { assertId(correction.context_id, "context_id"); next.goal.context_id = correction.context_id; }
  if (correction.accessible_routes) {
    if (!Array.isArray(correction.accessible_routes) || !correction.accessible_routes.length || correction.accessible_routes.some((id) => !ID.test(id))) throw new CurriculumServiceError("correction_scope", "Corrected routes must be bounded IDs");
    next.accessible_routes = [...new Set(correction.accessible_routes)].sort();
  }
  return stable(next);
}

function graphNode(node, sourceIds, accessRoutes) {
  return {
    node_id: node.node_id, kind: "capability", label: node.label, outcome: node.outcome,
    requirements: stable(node.requirements ?? []),
    evidence_contract: stable(node.evidence_contract ?? { provisional: ["varied_success"], retained: ["delayed_success"], transfer: ["novel_context"] }),
    misconception_ids: stable(node.misconception_ids ?? []), activity_mechanisms: stable(node.activity_mechanisms),
    importance: node.importance ?? "required", provenance: [...sourceIds].sort(),
    accessible_routes: [...new Set([...(node.accessible_routes ?? []), ...accessRoutes])].sort(), status: "active"
  };
}

function applyPlacement(graph, placement = []) {
  if (!Array.isArray(placement) || placement.length > 8) throw new CurriculumServiceError("placement_unbounded", "Placement is optional and limited to eight observations");
  const explanations = [];
  for (const item of placement) {
    if (!ID.test(item.node_id) || !["keep", "waive_prerequisite"].includes(item.decision) || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) throw new CurriculumServiceError("invalid_placement", "Placement observation is invalid");
    if (!graph.nodes.some((node) => node.node_id === item.node_id)) throw new CurriculumServiceError("invalid_placement", "Placement references an unknown node");
    if (item.decision === "waive_prerequisite" && item.confidence < 0.85) {
      explanations.push({ code: "placement_uncertain", node_id: item.node_id, action: "diagnostic_required", confidence: item.confidence });
      continue;
    }
    if (item.decision === "waive_prerequisite") {
      if (!ID.test(item.evidence_event_id) || !ID.test(item.authority_id) || Number.isNaN(Date.parse(item.expires_at))) throw new CurriculumServiceError("invalid_placement", "A high-confidence waiver requires evidence, authority, and expiry");
      for (const node of graph.nodes) for (const clause of node.requirements) if (clause.any_of.includes(item.node_id)) {
        const waiverId = `wav_${digest({ clause: clause.clause_id, item }).slice(0, 16)}`;
        graph.waivers.push({ waiver_id: waiverId, clause_id: clause.clause_id, authority: item.authority_id, evidence_event_id: item.evidence_event_id, expires_at: item.expires_at });
        clause.any_of.push(waiverId); clause.any_of.sort();
      }
      explanations.push({ code: "placement_waiver", node_id: item.node_id, action: "correctable_waiver", confidence: item.confidence });
    }
  }
  return explanations;
}

export function generateCurriculum({ request, registry, placement = [], now, revision = 1, parentGraphId = null }) {
  if (request?.schema !== "tutor.curriculum-generation-slice/v1") throw new CurriculumServiceError("invalid_request", "Minimized generation slice is required");
  const template = registry?.get?.(request.subject_id);
  if (!template || template.review_status !== "approved" || !Array.isArray(template.source_ids) || !template.source_ids.length || template.source_ids.some((id) => !ID.test(id)) || !HASH.test(template.source_digest)) {
    const fallback = registry?.get?.("reviewed_fallback");
    return fallback?.review_status === "approved" ? { status: "fallback", template_id: fallback.template_id, reason: "approved_source_unavailable" } : { status: "planning_required", reason: "approved_source_unavailable" };
  }
  const curriculumId = `cur_${digest({ user: request.user_ref, subject: request.subject_id }).slice(0, 16)}`;
  const graphId = `grf_${digest({ curriculumId, revision, template: template.template_id }).slice(0, 16)}`;
  const graph = {
    schema: "tutor.curriculum-graph/v1", graph_id: graphId, curriculum_id: curriculumId,
    parents: parentGraphId ? [parentGraphId] : [],
    nodes: template.nodes.map((node) => graphNode(node, template.source_ids, request.accessible_routes)), waivers: [], created_at: now
  };
  const placementExplanations = applyPlacement(graph, placement);
  try { validateGraphStructure(graph, { curriculumId }); } catch (error) {
    const fallback = registry.get("reviewed_fallback");
    return fallback?.review_status === "approved" ? { status: "fallback", template_id: fallback.template_id, reason: "graph_validation_failed", diagnostic: error.message } : { status: "planning_required", reason: "graph_validation_failed", diagnostic: error.message };
  }
  const curriculum = validateCurriculum({
    schema: "tutor.curriculum/v1", curriculum_id: curriculumId, user_id: request.user_ref,
    subject: { id: request.subject_id, label: template.subject_label },
    goal: { statement: template.goal_labels?.[request.goal.outcome_id] ?? "Demonstrate the selected outcome", target_horizon: template.target_horizon ?? "open" },
    graph_version: graphId, status: "active",
    generated_from: { profile_head: request.profile_version, diagnostic_event_set: placement.length ? `sha256:${digest(placement)}` : undefined, sources: template.source_ids },
    created_at: now, extensions: {}
  });
  return stable({
    status: "generated", curriculum, graph,
    explanation: {
      assumptions: [{ code: "approved_template", template_id: template.template_id }, { code: "goal_mapping", outcome_id: request.goal.outcome_id }, { code: "placement_optional", observation_count: placement.length }],
      placement: placementExplanations,
      uncertainty: placement.length ? "placement is provisional and correctable" : "no placement evidence; foundations remain visible",
      correction_actions: ["change_goal", "remove_waiver", "change_access_route", "request_human_plan"]
    }
  });
}

export class CurriculumLifecycle {
  #versions = new Map();
  publish(result) {
    if (result?.status !== "generated") throw new CurriculumServiceError("invalid_publication", "Only validated generated curricula can publish");
    const key = result.curriculum.curriculum_id;
    const versions = this.#versions.get(key) ?? [];
    if (versions.some((entry) => entry.graph.graph_id === result.graph.graph_id)) throw new CurriculumServiceError("immutable_collision", "Graph version already exists");
    if (versions.length && !result.graph.parents.includes(versions.at(-1).graph.graph_id)) throw new CurriculumServiceError("revision_conflict", "New graph must descend from the current version");
    versions.push(structuredClone(result)); this.#versions.set(key, versions); return result.graph.graph_id;
  }
  history(curriculumId) { return (this.#versions.get(curriculumId) ?? []).map((entry) => structuredClone(entry)); }
}

export function publishRevision({ prior, next, changes }) {
  if (prior.curriculum.curriculum_id !== next.curriculum.curriculum_id || !next.graph.parents.includes(prior.graph.graph_id)) throw new CurriculumServiceError("revision_conflict", "Revision must preserve curriculum identity and graph ancestry");
  const changeSet = validateChangeSet({ schema: "tutor.curriculum-change-set/v1", change_set_id: `chg_${digest({ from: prior.graph.graph_id, to: next.graph.graph_id, changes }).slice(0, 16)}`, curriculum_id: prior.curriculum.curriculum_id, from_graph_id: prior.graph.graph_id, to_graph_id: next.graph.graph_id, changes });
  return stable({ graph: next.graph, curriculum: next.curriculum, changeSet, evidence_mappings: changes.filter((change) => ["supersede", "split", "merge"].includes(change.operation)).map((change) => ({ from: change.from, to: change.to, transfer: "requires_explicit_semantic_review", confidence: change.confidence })) });
}
