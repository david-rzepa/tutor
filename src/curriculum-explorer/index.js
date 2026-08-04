import { validateCurriculum, validateGraphStructure } from "../../packages/curriculum-model/src/index.js";

const PRESENTATIONS = new Set(["guided", "compact"]);
const STATES = ["review_due", "ready", "learning", "blocked", "goal_reached", "archived"];
const ACTIONABLE = new Set(["review_due", "ready", "learning"]);
const PROGRESS = new Set(["unseen", "learning", "provisional", "retained", "transfer_verified", "needs_review", "archived"]);
const STATE_LABELS = Object.freeze({ review_due: "Review due", ready: "Ready now", learning: "Learning", blocked: "Upcoming or blocked", goal_reached: "Durable evidence", archived: "Archived" });
const PROGRESS_LABELS = Object.freeze({ unseen: "Not started", learning: "Learning", provisional: "Practising", retained: "Remembered after a break", transfer_verified: "Used in a new situation", needs_review: "Ready to revisit", archived: "Not on your path" });
const REASON_LABELS = Object.freeze({
  node_archived: "This outcome is archived.", safety_or_authority_constraint: "A safety or authority constraint blocks this outcome.",
  no_available_accessible_route: "No suitable accessible activity route is currently available.", active_acquisition: "Learning is in progress.",
  prerequisites_satisfied: "The required foundations have durable evidence.", foundation_available: "This is an available foundation.",
  evidence_review_due: "A delayed review is due.", later_contradictory_evidence: "Later evidence makes this uncertain."
});

export class ExplorerError extends Error {
  constructor(message) { super(message); this.name = "ExplorerError"; }
}

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const confidenceLabel = (value) => value >= 0.8 ? "higher confidence" : value >= 0.5 ? "developing confidence" : "limited evidence";
const reasonLabel = (reason) => reason.startsWith("unsatisfied:") ? `Requirement ${reason.slice(12)} still needs durable evidence.` : reason.startsWith("evidence_state_") ? `Evidence state: ${reason.slice(15).replaceAll("_", " ")}.` : (REASON_LABELS[reason] ?? reason.replaceAll("_", " "));

function validateBindings({ curriculum, graph, projection, readiness }) {
  validateCurriculum(curriculum); const structure = validateGraphStructure(graph, { curriculumId: curriculum.curriculum_id });
  if (curriculum.graph_version !== graph.graph_id) throw new ExplorerError("curriculum must bind the exact immutable graph version");
  if (projection?.schema !== "tutor.learning-projection/v1" || projection.algorithm_version !== "explicit_rules_v1" || projection.user_id !== curriculum.user_id || projection.curriculum_id !== curriculum.curriculum_id || projection.graph_id !== graph.graph_id) throw new ExplorerError("projection does not match the curriculum, graph, user, or trusted algorithm");
  if (readiness?.schema !== "tutor.curriculum-readiness/v1" || readiness.user_id !== curriculum.user_id || readiness.curriculum_id !== curriculum.curriculum_id || readiness.graph_id !== graph.graph_id) throw new ExplorerError("readiness does not match the exact projection scope");
  const ids = new Set(graph.nodes.map((node) => node.node_id));
  if ([...ids].some((id) => !projection.nodes?.[id] || !readiness.entries?.[id]) || Object.keys(projection.nodes).some((id) => !ids.has(id)) || Object.keys(readiness.entries).some((id) => !ids.has(id))) throw new ExplorerError("projection and readiness must cover exactly the graph nodes");
  if (!Number.isFinite(Date.parse(projection.projected_at))) throw new ExplorerError("projection instant must be inspectable");
  for (const id of ids) {
    const progress = projection.nodes[id]; const available = readiness.entries[id];
    if (progress.node_id !== id || !PROGRESS.has(progress.state) || typeof progress.confidence !== "number" || progress.confidence < 0 || progress.confidence > 1 || !Array.isArray(progress.evidence_ids) || !Array.isArray(progress.reasons)) throw new ExplorerError(`projection node ${id} is malformed`);
    if (available.node_id !== id || !STATES.includes(available.state) || !Array.isArray(available.reasons) || available.reasons.some((reason) => typeof reason !== "string")) throw new ExplorerError(`readiness node ${id} is malformed`);
  }
  if (!Array.isArray(readiness.ranked_candidates) || new Set(readiness.ranked_candidates).size !== readiness.ranked_candidates.length || readiness.ranked_candidates.some((id) => !ids.has(id) || !ACTIONABLE.has(readiness.entries[id].state))) throw new ExplorerError("ranked candidates must be unique actionable graph nodes");
  for (const state of STATES) {
    const expected = [...ids].filter((id) => readiness.entries[id].state === state).sort();
    if (!Array.isArray(readiness[state]) || JSON.stringify([...readiness[state]].sort()) !== JSON.stringify(expected)) throw new ExplorerError(`readiness ${state} set does not match its entries`);
  }
  return structure;
}

function depths(order, edges) {
  const result = Object.fromEntries(order.map((id) => [id, 0]));
  const incoming = new Map(order.map((id) => [id, []]));
  for (const edge of edges) incoming.get(edge.to).push(edge.from);
  for (const id of order) result[id] = incoming.get(id).length ? Math.max(...incoming.get(id).map((source) => result[source] + 1)) : 0;
  return result;
}

function routes(graph, structure, readiness, limit) {
  const outgoing = new Map(graph.nodes.map((node) => [node.node_id, []]));
  for (const edge of structure.edges) outgoing.get(edge.from).push(edge.to);
  for (const values of outgoing.values()) values.sort();
  const terminals = new Set(graph.nodes.filter((node) => node.status === "active" && node.importance === "required" && outgoing.get(node.node_id).length === 0).map((node) => node.node_id));
  const result = [];
  function visit(current, path) {
    if (result.length >= limit) return;
    if (terminals.has(current)) { result.push(path); return; }
    for (const next of outgoing.get(current)) visit(next, [...path, next]);
  }
  for (const start of readiness.ranked_candidates) { visit(start, [start]); if (result.length >= limit) break; }
  return result;
}

export function createExplorerModel({ curriculum, graph, projection, readiness, presentation = "guided", focusNodeId = null, maxRoutes = 3 }) {
  if (!PRESENTATIONS.has(presentation)) throw new ExplorerError("presentation must be explicitly guided or compact");
  if (!Number.isInteger(maxRoutes) || maxRoutes < 1 || maxRoutes > 5) throw new ExplorerError("route comparison must contain one to five choices");
  const structure = validateBindings({ curriculum, graph, projection, readiness }); const depth = depths(structure.order, structure.edges); const rows = new Map();
  const byId = new Map(graph.nodes.map((node) => [node.node_id, node]));
  const nodes = structure.order.map((id) => {
    const node = byId.get(id); const progress = projection.nodes[id]; const availability = readiness.entries[id]; const row = rows.get(depth[id]) ?? 0; rows.set(depth[id], row + 1);
    const requirements = node.requirements.map((clause) => ({
      clauseId: clause.clause_id,
      alternatives: clause.any_of.filter((member) => byId.has(member)).map((member) => ({ nodeId: member, label: byId.get(member).label })),
      satisfied: !availability.reasons.includes(`unsatisfied:${clause.clause_id}`)
    }));
    const durable = ["retained", "transfer_verified"].includes(progress.state);
    return Object.freeze({
      nodeId: id, label: node.label, outcome: node.outcome, importance: node.importance, availability: availability.state,
      availabilityLabel: STATE_LABELS[availability.state], reasons: availability.reasons.map(reasonLabel), requirements,
      progress: Object.freeze({ state: progress.state, label: PROGRESS_LABELS[progress.state], confidence: confidenceLabel(progress.confidence), evidenceCount: progress.evidence_ids.length, lastEvidenceAt: progress.last_evidence_at ?? null, nextCheckAt: progress.next_check_at ?? null, contradictionCount: progress.contradictions?.length ?? 0 }),
      position: Object.freeze({ column: depth[id] + 1, row: row + 1 }),
      operations: Object.freeze({ inspect: true, choose: ACTIONABLE.has(availability.state), revisit: progress.evidence_ids.length > 0 && progress.state !== "archived", correctAssumption: true, stop: true }),
      celebration: durable ? Object.freeze({ label: progress.state === "transfer_verified" ? "Transfer verified" : "Retention demonstrated", basis: "durable_learning_evidence", autoStart: false }) : null
    });
  });
  const ids = new Set(nodes.map((node) => node.nodeId)); const focus = focusNodeId && ids.has(focusNodeId) ? focusNodeId : readiness.ranked_candidates.find((id) => ids.has(id)) ?? structure.order[0];
  const routeChoices = routes(graph, structure, readiness, maxRoutes).map((path) => ({ nodeIds: path, labels: path.map((id) => byId.get(id).label) }));
  const groups = STATES.map((state) => ({ state, label: STATE_LABELS[state], nodeIds: nodes.filter((node) => node.availability === state).map((node) => node.nodeId) })).filter((group) => group.nodeIds.length);
  return Object.freeze({ schema: "tutor.curriculum-explorer/v1", curriculumId: curriculum.curriculum_id, graphId: graph.graph_id, graphParents: [...graph.parents], projectedAt: projection.projected_at, subject: curriculum.subject.label, goal: curriculum.goal.statement, presentation, focusNodeId: focus, nodes: Object.freeze(nodes), edges: Object.freeze(structure.edges.map((edge) => Object.freeze({ ...edge }))), groups: Object.freeze(groups), routeChoices: Object.freeze(routeChoices), controls: Object.freeze({ stopVisible: true, changeGoalVisible: true, startsSession: false }), privacy: "no_user_identity_or_raw_evidence" });
}

export function createPortfolioExplorer({ items, selectedCurriculumId = null, presentation = "guided", focusNodeId = null }) {
  if (!Array.isArray(items) || !items.length) throw new ExplorerError("at least one curriculum is required");
  const users = new Set(items.map((item) => item.curriculum?.user_id)); if (users.size !== 1) throw new ExplorerError("a portfolio cannot mix learner scopes");
  const ids = new Set(items.map((item) => item.curriculum?.curriculum_id)); if (ids.size !== items.length) throw new ExplorerError("portfolio curriculum IDs must be unique");
  const selectedId = selectedCurriculumId ?? items[0].curriculum.curriculum_id; const selected = items.find((item) => item.curriculum.curriculum_id === selectedId);
  if (!selected) throw new ExplorerError("selected curriculum is unavailable");
  const model = createExplorerModel({ ...selected, presentation, focusNodeId });
  return Object.freeze({ schema: "tutor.curriculum-portfolio-explorer/v1", selectedCurriculumId: selectedId, tabs: Object.freeze(items.map((item) => Object.freeze({ curriculumId: item.curriculum.curriculum_id, graphId: item.graph.graph_id, subject: item.curriculum.subject.label, selected: item.curriculum.curriculum_id === selectedId }))), explorer: model, privacy: "single_learner_scope_without_identity" });
}

export function preserveExplorerFocus(previous, next) {
  if (previous?.schema !== "tutor.curriculum-explorer/v1" || next?.schema !== "tutor.curriculum-explorer/v1") throw new ExplorerError("recognized explorer models are required");
  return next.nodes.some((node) => node.nodeId === previous.focusNodeId) ? previous.focusNodeId : next.focusNodeId;
}

export function createExplorerIntent(model, { operation, nodeId = null }) {
  if (model?.schema !== "tutor.curriculum-explorer/v1") throw new ExplorerError("recognized explorer model is required");
  const node = nodeId ? model.nodes.find((entry) => entry.nodeId === nodeId) : null;
  if (["inspect", "choose", "revisit", "correct_assumption"].includes(operation) && !node) throw new ExplorerError("operation requires a node in the bound graph");
  if (operation === "choose" && !node.operations.choose) throw new ExplorerError("blocked nodes cannot request an activity");
  if (operation === "revisit" && !node.operations.revisit) throw new ExplorerError("topics without prior progress cannot be revisited");
  const kinds = { inspect: "inspect_node", choose: "request_activity", revisit: "request_activity", correct_assumption: "request_correction", stop: "stop_exploring", change_goal: "request_goal_change" };
  if (!kinds[operation]) throw new ExplorerError("unknown explorer operation");
  return Object.freeze({ schema: "tutor.curriculum-explorer-intent/v1", operation: kinds[operation], curriculum_id: model.curriculumId, graph_id: model.graphId, node_id: node?.nodeId ?? null, starts_session: false, requires_host_confirmation: operation !== "inspect" });
}

function requirementText(node) {
  if (!node.requirements.length) return "";
  return node.requirements.map((clause) => `${clause.satisfied ? "Builds on" : "Comes after"} ${clause.alternatives.map((item) => item.label).join(" or ")}`).join(". ");
}

function nodeMarkup(node) {
  const revisit = node.operations.revisit ? `<button type="button" data-operation="revisit" data-node-id="${escapeHtml(node.nodeId)}">Revisit topic</button>` : "";
  const requirements = requirementText(node);
  const uncertainty = node.progress.contradictionCount || node.progress.state === "needs_review" ? "<p>This progress may need another check.</p>" : "";
  return `<article class="node state-${escapeHtml(node.availability)}" data-node-id="${escapeHtml(node.nodeId)}" tabindex="-1" style="--column:${node.position.column};--row:${node.position.row}"><h3>${escapeHtml(node.label)}</h3><p class="progress"><strong>${escapeHtml(node.progress.label)}</strong></p>${requirements ? `<p>${escapeHtml(requirements)}.</p>` : ""}${uncertainty}${revisit ? `<div class="actions">${revisit}</div>` : ""}</article>`;
}

export function renderExplorerDocument(model, { title = "Your learning map", reducedMotion = false } = {}) {
  if (model?.schema !== "tutor.curriculum-explorer/v1") throw new ExplorerError("recognized explorer model is required");
  const map = model.nodes.map(nodeMarkup).join("");
  const routesMarkup = model.routeChoices.length ? `<ol>${model.routeChoices.map((route) => `<li>${route.labels.map(escapeHtml).join(" → ")}</li>`).join("")}</ol>` : "<p>Your next route is still being worked out.</p>";
  const connections = model.edges.length ? `<ul class="connections">${model.edges.map((edge) => { const source = model.nodes.find((node) => node.nodeId === edge.from); const target = model.nodes.find((node) => node.nodeId === edge.to); return `<li>${escapeHtml(source.label)} → ${escapeHtml(target.label)}</li>`; }).join("")}</ul>` : "<p>This map has one topic.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{font-family:system-ui,sans-serif;color-scheme:light dark}body{max-width:70rem;margin:auto;padding:1rem}button{min-height:2.75rem;padding:.5rem .75rem}.map{display:grid;grid-template-columns:repeat(var(--columns,4),minmax(13rem,1fr));gap:1rem;overflow:auto}.map .node{grid-column:var(--column);grid-row:var(--row)}.node{border:2px solid;padding:1rem;border-radius:.5rem}.node h3{margin-block-start:0}.state-ready{border-style:solid}.state-learning{border-style:dashed}.state-blocked{border-style:dotted}.state-goal_reached{border-width:4px}.progress{font-size:1.05rem}@media(max-width:50rem){.map{display:block}.node{margin-block:1rem}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}@media print{.actions{display:none}.map{display:block}.node{break-inside:avoid;margin-block:.5rem;color:#000;background:#fff}}</style></head><body data-reduced-motion="${reducedMotion ? "true" : "system"}"><header><h1>${escapeHtml(title)}</h1><p><strong>${escapeHtml(model.subject)}</strong>: ${escapeHtml(model.goal)}</p></header><main><section aria-labelledby="route-title"><h2 id="route-title">Your route</h2>${routesMarkup}</section><section aria-labelledby="map-title"><h2 id="map-title">Topics and progress</h2><p>Arrows show what comes next. Each topic shows your progress in words.</p>${connections}<div class="map">${map}</div></section></main><p aria-live="polite"></p></body></html>`;
}

export function renderPortfolioDocument(portfolio, options = {}) {
  if (portfolio?.schema !== "tutor.curriculum-portfolio-explorer/v1") throw new ExplorerError("recognized portfolio model is required");
  const navigation = `<nav aria-label="Subjects"><ul>${portfolio.tabs.map((tab) => `<li><a href="?curriculum=${encodeURIComponent(tab.curriculumId)}"${tab.selected ? ' aria-current="page"' : ""}>${escapeHtml(tab.subject)}</a></li>`).join("")}</ul></nav>`;
  return renderExplorerDocument(portfolio.explorer, options).replace(/(<body[^>]*>)/, `$1${navigation}`);
}

export function renderTextSummary(model) {
  if (model?.schema !== "tutor.curriculum-explorer/v1") throw new ExplorerError("recognized explorer model is required");
  const lines = [`${model.subject}: ${model.goal}`, "Topics and progress"];
  for (const node of model.nodes) {
    const requirements = requirementText(node);
    const uncertainty = node.progress.contradictionCount || node.progress.state === "needs_review" ? " This progress may need another check." : "";
    lines.push(`- ${node.label}: ${node.progress.label}.${requirements ? ` ${requirements}.` : ""}${uncertainty}`);
  }
  if (model.routeChoices.length) lines.push("\nYour route", ...model.routeChoices.map((route, index) => `${index + 1}. ${route.labels.join(" -> ")}`));
  return `${lines.join("\n")}\n`;
}

export function wireExplorer(root, model, onIntent) {
  if (!root?.addEventListener || typeof onIntent !== "function") throw new ExplorerError("a browser root and intent handler are required");
  const handler = (event) => { const control = event.target?.closest?.("[data-operation]"); if (!control || !root.contains(control)) return; onIntent(createExplorerIntent(model, { operation: control.dataset.operation, nodeId: control.dataset.nodeId ?? null })); };
  root.addEventListener("click", handler);
  const focused = root.querySelector?.(`[data-node-id="${model.focusNodeId}"] button, [data-node-id="${model.focusNodeId}"]`); focused?.focus?.({ preventScroll: true });
  return () => root.removeEventListener("click", handler);
}
