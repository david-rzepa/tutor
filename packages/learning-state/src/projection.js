import { CurriculumValidationError, validateEvidenceEvent, validateGraphStructure } from "../../curriculum-model/src/index.js";

export const PROGRESS_STATES = Object.freeze(["unseen", "learning", "provisional", "retained", "transfer_verified", "needs_review", "archived"]);
const DAY = 86_400_000;
export const DEFAULT_PROJECTION_POLICY = Object.freeze({ provisionalReviewMs: 14 * DAY, retainedReviewMs: 60 * DAY, provisionalIndependentItems: 2 });

const time = (event) => Date.parse(event.observed_at);
const canonical = (events) => [...events].sort((left, right) => time(left) - time(right) || left.event_id.localeCompare(right.event_id));

function assertScope(events, scope) {
  for (const event of events) {
    validateEvidenceEvent(event);
    for (const field of ["user_id", "curriculum_id", "graph_id"]) if (event[field] !== scope[field]) throw new CurriculumValidationError([`evidence ${event.event_id} is outside ${field} scope`]);
  }
}

function projectOne(node, events, now, policy) {
  if (node.status === "archived") return Object.freeze({ node_id: node.node_id, state: "archived", confidence: 1, evidence_ids: [], reasons: ["node_archived"] });
  const ordered = canonical(events);
  if (!ordered.length) return Object.freeze({ node_id: node.node_id, state: "unseen", confidence: 0, evidence_ids: [], reasons: ["no_authorized_evidence"], next_check_at: null, help_dependence: 0, misconceptions: [] });
  const correct = ordered.filter((event) => event.observation.correct);
  const independent = correct.filter((event) => event.support.help_count === 0 && event.support.scaffold === "none");
  const independentItems = new Set(independent.map((event) => event.item_version));
  const transfer = independent.filter((event) => event.grade === "transfer" && event.observation.novel_context === true);
  const retained = independent.filter((event) => event.grade === "retained");
  let state = "learning";
  let strongest = null;
  if (independentItems.size >= policy.provisionalIndependentItems) { state = "provisional"; strongest = independent.at(-1); }
  if (independentItems.size >= policy.provisionalIndependentItems && retained.length) {
    const highGrade = [
      ...retained.map((event) => ({ event, state: "retained" })),
      ...transfer.map((event) => ({ event, state: "transfer_verified" }))
    ].sort((left, right) => time(left.event) - time(right.event) || left.event.event_id.localeCompare(right.event.event_id));
    state = highGrade.at(-1).state; strongest = highGrade.at(-1).event;
  }
  const last = ordered.at(-1);
  const strongestIndex = strongest ? ordered.findIndex((event) => event.event_id === strongest.event_id) : -1;
  const contradictory = strongestIndex >= 0 ? ordered.slice(strongestIndex + 1).filter((event) => !event.observation.correct) : [];
  const contradiction = contradictory.length > 0 && ["provisional", "retained", "transfer_verified"].includes(state);
  const reviewMs = state === "provisional" ? policy.provisionalReviewMs : ["retained", "transfer_verified"].includes(state) ? policy.retainedReviewMs : null;
  const nextCheck = strongest && reviewMs ? time(strongest) + reviewMs : null;
  const expired = nextCheck !== null && now >= nextCheck;
  if (contradiction || expired) state = "needs_review";
  const confidence = ordered.reduce((sum, event) => sum + event.uncertainty.confidence, 0) / ordered.length;
  const misconceptionIds = [...new Set(ordered.flatMap((event) => event.observation.misconception_ids ?? []))].sort();
  const helped = ordered.filter((event) => event.support.help_count > 0 || event.support.scaffold !== "none").length;
  return Object.freeze({
    node_id: node.node_id, state, confidence, evidence_ids: ordered.map((event) => event.event_id),
    strongest_independent_event_id: strongest?.event_id ?? null, last_evidence_at: last.observed_at,
    last_independent_at: independent.at(-1)?.observed_at ?? null,
    last_retained_at: retained.at(-1)?.observed_at ?? null, last_transfer_at: transfer.at(-1)?.observed_at ?? null,
    next_check_at: nextCheck === null ? null : new Date(nextCheck).toISOString(), help_dependence: helped / ordered.length,
    misconceptions: misconceptionIds,
    misconception_timeline: ordered.filter((event) => event.observation.misconception_ids?.length).map((event) => ({ event_id: event.event_id, observed_at: event.observed_at, misconception_ids: [...event.observation.misconception_ids].sort() })),
    contradictions: contradictory.map((event) => event.event_id),
    reasons: contradiction ? ["later_contradictory_evidence"] : expired ? ["evidence_review_due"] : [`evidence_supports_${state}`]
  });
}

export function projectCurriculum({ graph, events, user_id, curriculum_id = graph.curriculum_id, now = Date.now(), policy = {} }) {
  validateGraphStructure(graph, { curriculumId: curriculum_id });
  if (typeof user_id !== "string" || !user_id) throw new CurriculumValidationError(["opaque user_id is required"]);
  if (!Array.isArray(events) || !Number.isFinite(Number(now))) throw new CurriculumValidationError(["evidence list and finite projection instant are required"]);
  const scope = { user_id, curriculum_id, graph_id: graph.graph_id };
  assertScope(events, scope);
  const eventIds = new Set();
  for (const event of events) { if (eventIds.has(event.event_id)) throw new CurriculumValidationError([`duplicate evidence event ${event.event_id}`]); eventIds.add(event.event_id); }
  const nodeIds = new Set(graph.nodes.map((node) => node.node_id));
  const unknownNodes = events.filter((event) => !nodeIds.has(event.node_id)).map((event) => event.node_id);
  if (unknownNodes.length) throw new CurriculumValidationError([`evidence references unknown nodes: ${[...new Set(unknownNodes)].join(", ")}`]);
  if (events.some((event) => time(event) > Number(now))) throw new CurriculumValidationError(["evidence cannot occur after the projection instant"]);
  const resolvedPolicy = { ...DEFAULT_PROJECTION_POLICY, ...policy };
  if (!Number.isInteger(resolvedPolicy.provisionalIndependentItems) || resolvedPolicy.provisionalIndependentItems < 2 || !Number.isFinite(resolvedPolicy.provisionalReviewMs) || resolvedPolicy.provisionalReviewMs <= 0 || !Number.isFinite(resolvedPolicy.retainedReviewMs) || resolvedPolicy.retainedReviewMs <= 0) throw new CurriculumValidationError(["projection policy is invalid"]);
  const projections = Object.fromEntries(graph.nodes.map((node) => [node.node_id, projectOne(node, events.filter((event) => event.node_id === node.node_id), Number(now), resolvedPolicy)]));
  return Object.freeze({ schema: "tutor.learning-projection/v1", user_id, curriculum_id, graph_id: graph.graph_id, algorithm_version: "explicit_rules_v1", projected_at: new Date(Number(now)).toISOString(), nodes: Object.freeze(projections) });
}
