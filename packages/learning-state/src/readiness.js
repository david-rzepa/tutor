import { CurriculumValidationError, validateGraphStructure } from "../../curriculum-model/src/index.js";

const LEVEL = Object.freeze({ unseen: 0, learning: 1, needs_review: 1, provisional: 2, retained: 3, transfer_verified: 4, archived: -1 });
const THRESHOLD = Object.freeze({ learning: 1, provisional: 2, retained: 3, transfer_verified: 4 });

export function deriveReadiness({ graph, projection, now = Date.now(), blocked_node_ids = [], unavailable_routes = [], goal_path_ids = [], expected_learning_value = {}, access_fit = {} }) {
  const structure = validateGraphStructure(graph);
  if (projection?.schema !== "tutor.learning-projection/v1" || projection.algorithm_version !== "explicit_rules_v1" || typeof projection.user_id !== "string" || !projection.user_id || projection.graph_id !== graph.graph_id || projection.curriculum_id !== graph.curriculum_id || !projection.nodes || !Number.isFinite(Number(now))) throw new CurriculumValidationError(["projection does not match the trusted algorithm, graph version, curriculum, user, or time"]);
  const nodeIds = new Set(graph.nodes.map((node) => node.node_id));
  const missingProjection = [...nodeIds].filter((id) => !projection.nodes[id]);
  if (missingProjection.length) throw new CurriculumValidationError([`projection is missing nodes: ${missingProjection.join(", ")}`]);
  for (const id of nodeIds) {
    const progress = projection.nodes[id];
    if (progress.node_id !== id || !Object.hasOwn(LEVEL, progress.state) || typeof progress.confidence !== "number" || progress.confidence < 0 || progress.confidence > 1) throw new CurriculumValidationError([`projection node ${id} is invalid`]);
  }
  const unknownBlocked = blocked_node_ids.filter((id) => !nodeIds.has(id));
  if (unknownBlocked.length) throw new CurriculumValidationError([`unknown constrained nodes: ${unknownBlocked.join(", ")}`]);
  for (const [name, values] of [["expected learning value", expected_learning_value], ["access fit", access_fit]]) {
    if (!values || typeof values !== "object" || Object.entries(values).some(([id, value]) => !nodeIds.has(id) || typeof value !== "number" || value < 0 || value > 1)) throw new CurriculumValidationError([`${name} scores must map known nodes to values from zero to one`]);
  }
  const blockedBySafety = new Set(blocked_node_ids); const unavailable = new Set(unavailable_routes); const goalPath = new Set(goal_path_ids);
  const waiverById = new Map((graph.waivers ?? []).map((waiver) => [waiver.waiver_id, waiver]));
  const dependents = new Map(graph.nodes.map((node) => [node.node_id, 0]));
  for (const edge of structure.edges) dependents.set(edge.from, dependents.get(edge.from) + 1);
  const entries = {};
  for (const id of structure.order) {
    const node = graph.nodes.find((candidate) => candidate.node_id === id); const progress = projection.nodes[id]; const reasons = [];
    let state = "blocked";
    if (node.status === "archived") { state = "archived"; reasons.push("node_archived"); }
    else if (blockedBySafety.has(id)) reasons.push("safety_or_authority_constraint");
    else if (node.accessible_routes.every((route) => unavailable.has(route))) reasons.push("no_available_accessible_route");
    else if (progress.state === "needs_review") { state = "review_due"; reasons.push(...progress.reasons); }
    else if (LEVEL[progress.state] >= LEVEL.retained) { state = "goal_reached"; reasons.push(`evidence_state_${progress.state}`); }
    else {
      const unsatisfied = [];
      for (const clause of node.requirements) {
        const threshold = THRESHOLD[clause.threshold ?? "retained"] ?? THRESHOLD.retained;
        const satisfied = clause.any_of.some((member) => {
          const waiver = waiverById.get(member);
          if (waiver) return waiver.clause_id === clause.clause_id && Date.parse(waiver.expires_at) > Number(now);
          return projection.nodes[member] && LEVEL[projection.nodes[member].state] >= threshold;
        });
        if (!satisfied) unsatisfied.push(clause.clause_id);
      }
      if (unsatisfied.length) reasons.push(...unsatisfied.map((clause) => `unsatisfied:${clause}`));
      else if (progress.state === "learning") { state = "learning"; reasons.push("active_acquisition"); }
      else { state = "ready"; reasons.push(node.requirements.length ? "prerequisites_satisfied" : "foundation_available"); }
    }
    const overdueDays = progress.next_check_at && Number(now) > Date.parse(progress.next_check_at) ? Math.min(99, Math.floor((Number(now) - Date.parse(progress.next_check_at)) / 86_400_000)) : 0;
    const factors = Object.freeze({
      review_due: state === "review_due" ? 1000 : 0, goal_path: goalPath.has(id) ? 100 : 0,
      prerequisite_leverage: dependents.get(id) * 10, required_outcome: node.importance === "required" ? 20 : 0,
      evidence_uncertainty: Math.round((1 - progress.confidence) * 10), retention_overdue: overdueDays,
      expected_learning_value: Math.round((expected_learning_value[id] ?? 0) * 20), access_fit: Math.round((access_fit[id] ?? 0) * 10)
    });
    const score = Object.values(factors).reduce((sum, value) => sum + value, 0);
    entries[id] = Object.freeze({ node_id: id, state, reasons, score, score_factors: factors, confidence: progress.confidence });
  }
  const candidates = Object.values(entries).filter((entry) => ["ready", "review_due", "learning"].includes(entry.state)).sort((left, right) => right.score - left.score || left.node_id.localeCompare(right.node_id));
  const sets = Object.fromEntries(["blocked", "ready", "learning", "review_due", "goal_reached", "archived"].map((state) => [state, Object.values(entries).filter((entry) => entry.state === state).map((entry) => entry.node_id).sort()]));
  return Object.freeze({ schema: "tutor.curriculum-readiness/v1", user_id: projection.user_id, curriculum_id: graph.curriculum_id, graph_id: graph.graph_id, entries: Object.freeze(entries), ...sets, ranked_candidates: candidates.map((entry) => entry.node_id) });
}
