import { CurriculumValidationError, validateGraph } from "./validation.js";

export function graphEdges(graph) {
  const waiverIds = new Set((graph.waivers ?? []).map((waiver) => waiver.waiver_id));
  return graph.nodes.flatMap((node) => node.requirements.flatMap((clause) => clause.any_of.filter((id) => !waiverIds.has(id)).map((from) => ({ from, to: node.node_id, clause_id: clause.clause_id }))));
}

function adjacency(graph) {
  const result = new Map(graph.nodes.map((node) => [node.node_id, []]));
  for (const { from, to } of graphEdges(graph)) result.get(from).push(to);
  for (const targets of result.values()) targets.sort();
  return result;
}

export function findCycle(graph) {
  const edges = adjacency(graph); const color = new Map(); const stack = [];
  function visit(node) {
    color.set(node, 1); stack.push(node);
    for (const next of edges.get(node)) {
      if (!color.has(next)) { const cycle = visit(next); if (cycle) return cycle; }
      else if (color.get(next) === 1) { const start = stack.indexOf(next); return [...stack.slice(start), next]; }
    }
    stack.pop(); color.set(node, 2); return null;
  }
  for (const node of [...edges.keys()].sort()) if (!color.has(node)) { const cycle = visit(node); if (cycle) return cycle; }
  return null;
}

export function topologicalSort(graph) {
  validateGraph(graph);
  const cycle = findCycle(graph);
  if (cycle) throw new CurriculumValidationError([`cycle: ${cycle.join(" -> ")}`]);
  const edges = adjacency(graph); const indegree = new Map([...edges.keys()].map((id) => [id, 0]));
  for (const targets of edges.values()) for (const target of targets) indegree.set(target, indegree.get(target) + 1);
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort(); const order = [];
  while (ready.length) {
    const current = ready.shift(); order.push(current);
    for (const target of edges.get(current)) { indegree.set(target, indegree.get(target) - 1); if (indegree.get(target) === 0) { ready.push(target); ready.sort(); } }
  }
  return order;
}

export function validateGraphStructure(graph, options) {
  validateGraph(graph, options);
  const cycle = findCycle(graph);
  if (cycle) throw new CurriculumValidationError([`cycle: ${cycle.join(" -> ")}`]);
  const order = topologicalSort(graph);
  const active = new Set(graph.nodes.filter((node) => node.status === "active").map((node) => node.node_id));
  const required = graph.nodes.filter((node) => node.status === "active" && node.importance === "required");
  const reachable = new Set();
  for (const id of order) {
    const node = graph.nodes.find((entry) => entry.node_id === id);
    if (node.status !== "active") continue;
    const clausesSatisfied = node.requirements.every((clause) => clause.any_of.some((member) => reachable.has(member) || (graph.waivers ?? []).some((waiver) => waiver.waiver_id === member)));
    if (!node.requirements.length || clausesSatisfied) reachable.add(id);
  }
  const missing = required.filter((node) => active.has(node.node_id) && !reachable.has(node.node_id)).map((node) => node.node_id);
  if (missing.length) throw new CurriculumValidationError([`required nodes are unreachable: ${missing.join(", ")}`]);
  return Object.freeze({ order, edges: graphEdges(graph), reachable: [...reachable].sort() });
}
