import assert from "node:assert/strict";
import test from "node:test";
import { deriveReadiness, projectCurriculum } from "../../packages/learning-state/src/index.js";
import { createExplorerIntent, createExplorerModel, createPortfolioExplorer, ExplorerError, preserveExplorerFocus, renderExplorerDocument, renderPortfolioDocument, renderTextSummary, wireExplorer } from "../../src/curriculum-explorer/index.js";

const start = Date.parse("2026-01-01T00:00:00Z"); const iso = (days) => new Date(start + days * 86_400_000).toISOString();
function node(id, label, requirements = [], overrides = {}) { return { node_id: id, kind: "capability", label, outcome: `Demonstrate ${label}.`, requirements, evidence_contract: { provisional: ["varied_success"], retained: ["delayed_success"], transfer: ["novel_context"] }, misconception_ids: [], activity_mechanisms: ["generic_card"], importance: "required", provenance: ["source:approved-v1"], accessible_routes: ["semantic_text"], status: "active", ...overrides }; }
function fixture(domain = "science", version = "v1", user = "usr_synthetic", presentation = "guided") {
  const curriculumId = `cur_${domain}`; const graphId = `grf_${domain}_${version}`;
  const graph = { schema: "tutor.curriculum-graph/v1", graph_id: graphId, curriculum_id: curriculumId, parents: version === "v1" ? [] : [`grf_${domain}_v1`], created_at: iso(0), waivers: [], nodes: [
    node(`cap_${domain}_foundation`, `${domain} foundation`), node(`cap_${domain}_alternative`, `${domain} alternative`, [], { importance: "optional" }),
    node(`cap_${domain}_goal`, `${domain} goal`, [{ clause_id: `req_${domain}_route`, any_of: [`cap_${domain}_foundation`, `cap_${domain}_alternative`] }])
  ] };
  const curriculum = { schema: "tutor.curriculum/v1", curriculum_id: curriculumId, user_id: user, subject: { id: `subject.${domain}`, label: domain[0].toUpperCase() + domain.slice(1) }, goal: { statement: `Understand ${domain} relationships`, target_horizon: "open" }, graph_version: graphId, status: "active", generated_from: { profile_head: "hed_profile_v1", diagnostic_event_set: `sha256:${"0".repeat(64)}`, sources: ["source:approved-v1"] }, created_at: iso(0), extensions: {} };
  const events = [event("evt_one", graph.nodes[0].node_id, curriculumId, graphId, user, 1, "item_one"), event("evt_two", graph.nodes[0].node_id, curriculumId, graphId, user, 2, "item_two"), event("evt_retained", graph.nodes[0].node_id, curriculumId, graphId, user, 10, "item_three", "retained")];
  const projection = projectCurriculum({ graph, events, user_id: user, now: Date.parse(iso(20)) }); const readiness = deriveReadiness({ graph, projection, now: Date.parse(iso(20)), goal_path_ids: [graph.nodes[2].node_id] });
  return { curriculum, graph, projection, readiness, presentation };
}
function event(id, nodeId, curriculumId, graphId, userId, day, item, grade = "observation") { return { schema: "tutor.evidence-event/v1", event_id: id, user_id: userId, curriculum_id: curriculumId, graph_id: graphId, node_id: nodeId, objective_id: `obj_${nodeId}`, item_version: item, rubric_version: "rubric_v1", assistant_version: "assistant_v1", algorithm_version: "evaluator_v1", grade, observation: { correct: true }, support: { scaffold: "none", help_count: 0 }, uncertainty: { confidence: 0.8 }, privacy: { class: "learning_record", purpose: "progress_projection" }, provenance: ["source:synthetic"], observed_at: iso(day) }; }

test("visual map, semantic outline, and text summary share every node and meaning", () => {
  for (const domain of ["science", "music", "mathematics"]) {
    const model = createExplorerModel(fixture(domain)); const html = renderExplorerDocument(model); const text = renderTextSummary(model);
    for (const node of model.nodes) { assert.ok(html.includes(node.label)); assert.ok(text.includes(node.label)); assert.equal((html.match(new RegExp(`data-node-id="${node.nodeId}"`, "g")) ?? []).length >= 2, true); }
    assert.match(html, /Equivalent outline/); assert.match(html, /prerequisite → dependent/); assert.match(html, /prefers-reduced-motion/); assert.match(html, /@media print/); assert.match(html, /Stop exploring/); assert.match(text, /Stop and change-goal controls/); assert.match(text, /needed:|satisfied:/);
  }
});

test("immutable scope mismatches and cross-user portfolios fail closed", () => {
  const value = fixture(); const wrongGraph = structuredClone(value.graph); wrongGraph.graph_id = "grf_science_wrong";
  assert.throws(() => createExplorerModel({ ...value, graph: wrongGraph }), ExplorerError);
  const forged = structuredClone(value.readiness); forged.graph_id = "grf_science_wrong"; assert.throws(() => createExplorerModel({ ...value, readiness: forged }), ExplorerError);
  const forgedState = structuredClone(value.readiness); forgedState.entries.cap_science_goal.state = "mastered"; assert.throws(() => createExplorerModel({ ...value, readiness: forgedState }), /malformed/);
  const forgedProgress = structuredClone(value.projection); forgedProgress.nodes.cap_science_goal.confidence = 2; assert.throws(() => createExplorerModel({ ...value, projection: forgedProgress }), /malformed/);
  assert.throws(() => createPortfolioExplorer({ items: [value, fixture("music", "v1", "usr_other")] }), /cannot mix learner scopes/);
});

test("multi-curriculum tabs expose versions without learner identity", () => {
  const items = [fixture("science"), fixture("music"), fixture("mathematics")]; const portfolio = createPortfolioExplorer({ items, selectedCurriculumId: "cur_music", presentation: "compact" });
  assert.equal(portfolio.tabs.length, 3); assert.equal(portfolio.explorer.subject, "Music"); assert.equal(portfolio.explorer.presentation, "compact");
  assert.doesNotMatch(JSON.stringify(portfolio), /usr_synthetic/); assert.deepEqual(portfolio.tabs.map((tab) => tab.graphId), ["grf_science_v1", "grf_music_v1", "grf_mathematics_v1"]);
  const html = renderPortfolioDocument(portfolio); assert.match(html, /aria-label="Curricula"/); assert.match(html, /aria-current="page"/); for (const item of items) assert.match(html, new RegExp(item.curriculum.subject.label));
});

test("guided and compact presentations preserve operations, routes, and progress meaning", () => {
  const guided = createExplorerModel(fixture("science", "v1", "usr_synthetic", "guided")); const compact = createExplorerModel(fixture("science", "v1", "usr_synthetic", "compact"));
  assert.deepEqual(guided.nodes, compact.nodes); assert.deepEqual(guided.routeChoices, compact.routeChoices); assert.deepEqual(guided.groups, compact.groups);
  assert.ok(guided.routeChoices.length <= 3); assert.deepEqual(guided.routeChoices[0].nodeIds, ["cap_science_goal"]);
});

test("focus survives projection refresh and falls back deterministically across graph revisions", () => {
  const first = createExplorerModel({ ...fixture(), focusNodeId: "cap_science_alternative" }); const refreshed = createExplorerModel(fixture());
  assert.equal(preserveExplorerFocus(first, refreshed), "cap_science_alternative");
  const revisedFixture = fixture("science", "v2"); revisedFixture.graph.nodes[1].node_id = "cap_science_replacement"; revisedFixture.graph.nodes[2].requirements[0].any_of[1] = "cap_science_replacement";
  revisedFixture.projection = projectCurriculum({ graph: revisedFixture.graph, events: revisedFixture.projection.nodes.cap_science_foundation.evidence_ids.map((id, index) => event(id, "cap_science_foundation", "cur_science", "grf_science_v2", "usr_synthetic", [1, 2, 10][index], `item_${index}`, index === 2 ? "retained" : "observation")), user_id: "usr_synthetic", now: Date.parse(iso(20)) });
  revisedFixture.readiness = deriveReadiness({ graph: revisedFixture.graph, projection: revisedFixture.projection, now: Date.parse(iso(20)) }); const revised = createExplorerModel(revisedFixture);
  assert.equal(preserveExplorerFocus(first, revised), revised.focusNodeId); assert.deepEqual(revised.graphParents, ["grf_science_v1"]);
});

test("intents require host confirmation and never start sessions", () => {
  const model = createExplorerModel(fixture()); const ready = model.nodes.find((node) => node.operations.choose); const blocked = model.nodes.find((node) => !node.operations.choose);
  const choose = createExplorerIntent(model, { operation: "choose", nodeId: ready.nodeId }); assert.equal(choose.operation, "request_activity"); assert.equal(choose.starts_session, false); assert.equal(choose.requires_host_confirmation, true);
  assert.throws(() => createExplorerIntent(model, { operation: "choose", nodeId: blocked.nodeId }), /blocked nodes/);
  assert.equal(createExplorerIntent(model, { operation: "stop" }).operation, "stop_exploring"); assert.equal(createExplorerIntent(model, { operation: "correct_assumption", nodeId: ready.nodeId }).operation, "request_correction");
});

test("only durable evidence receives precise non-coercive recognition", () => {
  const model = createExplorerModel(fixture()); const retained = model.nodes.find((node) => node.progress.state === "retained"); const unseen = model.nodes.find((node) => node.progress.state === "unseen");
  assert.deepEqual(retained.celebration, { label: "Retention demonstrated", basis: "durable_learning_evidence", autoStart: false }); assert.equal(unseen.celebration, null);
  const html = renderExplorerDocument(model); assert.doesNotMatch(html, /leaderboard|countdown|points for|session started/i); assert.match(html, /not time, clicks, or streaks/); assert.match(html, /Nothing starts automatically/);
});

test("rendering escapes labels while retaining native keyboard controls", () => {
  const value = fixture(); value.graph.nodes[0].label = "Foundation <script>alert(1)</script>"; value.curriculum.subject.label = "Science & systems";
  const html = renderExplorerDocument(createExplorerModel(value), { reducedMotion: true }); assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/); assert.match(html, /<button type="button"/); assert.match(html, /aria-live="polite"/); assert.match(html, /data-reduced-motion="true"/);
});

test("browser wiring focuses the stable node and emits only host-bound intents", () => {
  const model = createExplorerModel(fixture()); const ready = model.nodes.find((node) => node.operations.choose); let listener; let focused = false; const intents = [];
  const control = { dataset: { operation: "choose", nodeId: ready.nodeId } };
  const root = { addEventListener: (_name, value) => { listener = value; }, removeEventListener: (_name, value) => { assert.equal(value, listener); }, contains: (value) => value === control, querySelector: () => ({ focus: ({ preventScroll }) => { focused = preventScroll; } }) };
  const dispose = wireExplorer(root, model, (intent) => intents.push(intent)); listener({ target: { closest: () => control } }); dispose();
  assert.equal(focused, true); assert.equal(intents.length, 1); assert.equal(intents[0].operation, "request_activity"); assert.equal(intents[0].starts_session, false);
});
