import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const python = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const script = path.resolve(".agents/skills/run-human-acceptance/scripts/checkpoint.py");
const productCheckpoint = "a".repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "tutor-acceptance-test-")); const plan = path.join(root, "plan.md"); const manifest = path.join(root, "workspace.json"); const checkpoint = path.join(root, "run.json");
  await writeFile(plan, "# Synthetic acceptance plan\n");
  await writeFile(manifest, `${JSON.stringify({ schema: "tutor.workspace/v1", workspace_id: "wrk_acceptance", test_only: true })}\n`);
  return { root, plan, manifest, checkpoint };
}

function invoke(args, expected = 0) {
  const result = spawnSync(python, [script, ...args], { cwd: path.resolve("."), encoding: "utf8", windowsHide: true });
  assert.equal(result.status, expected, `command ${args[0]}: ${result.stderr || result.stdout}`);
  const stream = expected === 0 ? result.stdout : result.stderr;
  return JSON.parse(stream.trim());
}

function binding(value, version = "test-v1") { return ["--checkpoint", value.checkpoint, "--plan", value.plan, "--plan-version", version]; }
function initialize(value, manifest = value.manifest) { return invoke(["init", ...binding(value), "--run-id", "run_acceptance", "--platform", "windows", "--product-checkpoint", productCheckpoint, "--workspace-manifest", manifest, "--synthetic-confirmed"]); }
function action(value, scenario, category, outcome = "match", evidence = null) {
  invoke(["begin-action", ...binding(value), "--scenario", scenario, "--action", "act_probe"]);
  invoke(["observe", ...binding(value), "--category", category, ...(evidence ? ["--evidence-ref", evidence] : [])]);
  invoke(["complete-action", ...binding(value), "--outcome", outcome, "--assigned-by", "human"]);
}

test("checkpoint lifecycle records every human result, pause/resume, summary, decision, and exact reset", async () => {
  const value = await fixture();
  try {
    const initialized = initialize(value); assert.deepEqual(initialized.workspace, { workspace_id: "wrk_acceptance", schema: "tutor.workspace/v1", test_only: true });
    invoke(["feedback", ...binding(value), "--kind", "ux", "--summary", "Completion state was not obvious", "--scenario", "scn_success", "--action", "act_probe", "--assigned-by", "human"]);
    const cases = [
      ["scn_success", "as-expected", "match", "pass", "not-applicable", "artifacts/success.json"],
      ["scn_failure", "different", "mismatch", "fail", "major", "artifacts/failure.json"],
      ["scn_blocked", "unavailable", "mismatch", "blocked", "blocking", null],
      ["scn_skipped", "unavailable", "mismatch", "skipped", "not-applicable", null]
    ];
    for (const [scenario, category, outcome, verdict, severity, evidence] of cases) {
      action(value, scenario, category, outcome, evidence);
      invoke(["verdict", ...binding(value), "--scenario", scenario, "--value", verdict, "--severity", severity, "--assigned-by", "human"]);
    }
    invoke(["pause", ...binding(value)]); assert.match(invoke(["begin-action", ...binding(value), "--scenario", "scn_paused", "--action", "act_probe"], 2).error, /resumed/); invoke(["resume", ...binding(value)]);
    const summary = invoke(["summary", ...binding(value)]); assert.deepEqual(summary.counts, { blocked: 1, fail: 1, pass: 1, skipped: 1 }); assert.equal(summary.blocking_coverage_gates, 1); assert.equal(summary.decision_required, true); assert.deepEqual(summary.evidence_refs, ["artifacts/failure.json", "artifacts/success.json"]); assert.equal(summary.feedback_count, 1); assert.deepEqual(summary.feedback[0], { action: "act_probe", assigned_by: "human", feedback_id: summary.feedback[0].feedback_id, kind: "ux", scenario: "scn_success", summary: "Completion state was not obvious" });
    const decided = invoke(["decide", ...binding(value), "--value", "conditional", "--assigned-by", "human"]); assert.deepEqual(decided.human_decision, { assigned_by: "human", value: "conditional" });
    const bytes = await readFile(value.checkpoint, "utf8"); assert.doesNotMatch(bytes, new RegExp(value.root.replaceAll("\\", "\\\\"))); assert.doesNotMatch(bytes, /raw observation|transcript|https?:|secret|full_name|email/i);
    assert.match(invoke(["reset", ...binding(value), "--confirm-run-id", "wrong_run"], 2).error, /exact run ID/); assert.equal(invoke(["reset", ...binding(value), "--confirm-run-id", "run_acceptance"]).status, "reset");
    await assert.rejects(readFile(value.checkpoint), { code: "ENOENT" });
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("checkpoint integrity rejects unsafe workspace, binding, evidence, sequencing, and agent ownership", async () => {
  const value = await fixture();
  try {
    const unsafe = path.join(value.root, "unsafe.json"); await writeFile(unsafe, `${JSON.stringify({ schema: "tutor.workspace/v1", workspace_id: "wrk_real", test_only: false })}\n`);
    const result = invoke(["init", ...binding(value), "--run-id", "run_acceptance", "--platform", "windows", "--product-checkpoint", productCheckpoint, "--workspace-manifest", unsafe, "--synthetic-confirmed"], 2);
    assert.match(result.error, /workspace manifest must be.*test_only/);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("reduced-motion action requires privacy-safe setup and reset evidence", async () => {
  const value = await fixture();
  try {
    initialize(value);
    assert.match(invoke(["begin-action", ...binding(value), "--scenario", "scn_access", "--action", "act_motion"], 2).error, /requires verified setup evidence/);
    invoke(["begin-action", ...binding(value), "--scenario", "scn_access", "--action", "act_motion", "--setup-ref", "artifacts/reduced-motion-active.json"]);
    invoke(["observe", ...binding(value), "--category", "as-expected"]);
    assert.match(invoke(["complete-action", ...binding(value), "--outcome", "match", "--assigned-by", "human"], 2).error, /requires verified reset evidence/);
    invoke(["complete-action", ...binding(value), "--outcome", "match", "--reset-ref", "artifacts/reduced-motion-reset.json", "--assigned-by", "human"]);
    invoke(["verdict", ...binding(value), "--scenario", "scn_access", "--value", "pass", "--severity", "not-applicable", "--assigned-by", "human"]);
    assert.deepEqual(invoke(["summary", ...binding(value)]).evidence_refs, ["artifacts/reduced-motion-active.json", "artifacts/reduced-motion-reset.json"]);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test("initialized checkpoint fails closed on all negative integrity paths", async () => {
  const value = await fixture();
  try {
    initialize(value); const originalPlan = await readFile(value.plan, "utf8"); await writeFile(value.plan, `${originalPlan}changed\n`);
    assert.match(invoke(["summary", ...binding(value)], 2).error, /digest changed/); await writeFile(value.plan, originalPlan);
    assert.match(invoke(["summary", ...binding(value, "test-v2")], 2).error, /version.*changed/);
    invoke(["begin-action", ...binding(value), "--scenario", "scn_owner", "--action", "act_probe"]);
    assert.match(invoke(["observe", ...binding(value), "--category", "different", "--evidence-ref", "https://example.invalid/raw"], 2).error, /relative opaque artifact/);
    invoke(["observe", ...binding(value), "--category", "different"]);
    assert.match(invoke(["complete-action", ...binding(value), "--outcome", "mismatch", "--assigned-by", "agent"], 2).error, /human-assigned/);
    assert.match(invoke(["begin-action", ...binding(value), "--scenario", "scn_parallel", "--action", "act_probe"], 2).error, /active action/);
    invoke(["complete-action", ...binding(value), "--outcome", "mismatch", "--assigned-by", "human"]);
    assert.match(invoke(["verdict", ...binding(value), "--scenario", "scn_owner", "--value", "fail", "--severity", "major", "--assigned-by", "agent"], 2).error, /human-assigned/);
    invoke(["verdict", ...binding(value), "--scenario", "scn_owner", "--value", "fail", "--severity", "major", "--assigned-by", "human"]);
    assert.match(invoke(["decide", ...binding(value), "--value", "no-go", "--assigned-by", "agent"], 2).error, /human-assigned/);
    assert.match(invoke(["feedback", ...binding(value), "--kind", "ux", "--summary", "See https://example.invalid/private", "--assigned-by", "human"], 2).error, /must not contain/);
    assert.match(invoke(["feedback", ...binding(value), "--kind", "ux", "--summary", "Useful feedback item", "--assigned-by", "agent"], 2).error, /human-assigned/);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
