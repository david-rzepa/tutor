import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createAssistantModuleCapabilities,
  normalizePortableSegment,
  openWorkspaceRepository,
  RepositoryError
} from "../../src/workspace-repository/index.js";

async function fixture({ version = 1 } = {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-repository-"));
  const workspace = path.join(base, "selected workspace");
  const local = path.join(base, "machine-state");
  await mkdir(workspace);
  await mkdir(local);
  await writeFile(path.join(workspace, "workspace.json"), `${JSON.stringify({
    schema: `tutor.workspace/v${version}`, workspace_id: "wrk_example", format_version: version, created_at: "2026-08-04T00:00:00Z"
  })}\n`);
  const actor = {
    userId: "usr_alex",
    capabilities: ["profile.read", "profile.write", "curriculum.read", "curriculum.write", "session-summary.read", "session-summary.write", "evidence.read", "evidence.write"]
  };
  return { base, workspace, local, actor };
}

async function withFixture(run, options) {
  const context = await fixture(options);
  try { await run(context); } finally { await rm(context.base, { recursive: true, force: true }); }
}

test("opens a user-selected root without exposing its absolute path", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  assert.deepEqual(repository.descriptor, { workspaceId: "wrk_example", mode: "read-write", diagnostic: null });
  assert.equal(JSON.stringify(repository).includes(workspace), false);
}));

test("typed repositories publish verified immutable records through opaque IDs", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  for (const [kind, recordId] of [["profile", "pro_version1"], ["curriculum", "cur_science"], ["session-summary", "sum_session1"], ["evidence", "evt_attempt1"]]) {
    const result = await repository.publish({ userId: "usr_alex", kind, recordId, payload: { schema_version: 1, subject: "generic" } });
    assert.match(result.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal((await repository.read({ userId: "usr_alex", kind, recordId })).payload.subject, "generic");
    assert.equal(kind === "profile" || kind === "curriculum", Boolean(result.headId));
  }
}));

test("reads verify schema identity and optional content digest", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  const published = await repository.publish({ userId: "usr_alex", kind: "evidence", recordId: "evt_verified", payload: { score: 1 } });
  assert.equal((await repository.read({ userId: "usr_alex", kind: "evidence", recordId: "evt_verified", expectedDigest: published.digest })).payload.score, 1);
  await assert.rejects(repository.read({ userId: "usr_alex", kind: "evidence", recordId: "evt_verified", expectedDigest: `sha256:${"0".repeat(64)}` }), { code: "digest_mismatch" });
  await writeFile(path.join(workspace, "users", "usr_alex", "evidence", "records", "evt_verified.json"), `${JSON.stringify({ schema: "tutor.evidence/v1", workspace_id: "wrk_example", user_id: "usr_other", record_id: "evt_verified", payload: {} })}\n`);
  await assert.rejects(repository.read({ userId: "usr_alex", kind: "evidence", recordId: "evt_verified" }), { code: "record_identity_mismatch" });
}));

test("authorization, reserved raw data, unknown kinds, and module isolation default deny", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  await assert.rejects(repository.publish({ userId: "usr_other", kind: "profile", recordId: "pro_other", payload: {} }), { code: "cross_user_denied" });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_private", payload: { raw_transcript: "no" } }), { code: "raw_reserved" });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "files", recordId: "fil_any", payload: {} }), { code: "unknown_kind" });
  const emitted = [];
  const module = createAssistantModuleCapabilities({ emit: (...entry) => emitted.push(entry) });
  assert.deepEqual(Object.keys(module), ["recordAttempt", "requestAdaptation"]);
  module.recordAttempt({ item: "opaque_item" });
  assert.deepEqual(emitted, [["attempt.recorded", { item: "opaque_item" }]]);
}));

test("concurrent mutable heads are surfaced and quarantined without timestamp wins", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  const first = await repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_devicea", payload: { preference: "audio" }, deviceId: "dev_alpha" });
  await repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_deviceb", payload: { preference: "visual" }, deviceId: "dev_beta" });
  const conflict = await repository.inspectHeads({ userId: "usr_alex", kind: "profile" });
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.current.includes(first.headId), true);
  assert.match(await readFile(path.join(workspace, "quarantine", `${conflict.caseId}.json`), "utf8"), /tutor\.conflict\/v1/);
}));

test("a parented head converges while identical immutable IDs with changed bytes are corruption", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  const first = await repository.publish({ userId: "usr_alex", kind: "curriculum", recordId: "cur_version1", payload: { version: 1 } });
  const second = await repository.publish({ userId: "usr_alex", kind: "curriculum", recordId: "cur_version2", payload: { version: 2 }, parents: [first.headId] });
  assert.deepEqual(await repository.inspectHeads({ userId: "usr_alex", kind: "curriculum" }), { status: "current", current: [second.headId], caseId: null });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "curriculum", recordId: "cur_version1", payload: { version: 99 } }), { code: "identity_collision" });
}));

test("faults before publication leave no head and journaled work is recoverable", async () => withFixture(async ({ workspace, local, actor }) => {
  const points = [];
  const repository = await openWorkspaceRepository({
    workspaceRoot: workspace, localStateRoot: local, actor,
    fault: async (point) => { points.push(point); if (point === "before_head") throw Object.assign(new Error("disk full"), { code: "ENOSPC" }); }
  });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_interrupted", payload: { preference: "text" } }), { code: "ENOSPC" });
  assert.deepEqual(points, ["after_stage", "after_object", "after_journal", "before_head"]);
  assert.deepEqual(await repository.inspectHeads({ userId: "usr_alex", kind: "profile" }), { status: "empty", current: [], caseId: null });
  const recovery = await repository.recover();
  assert.equal(recovery.pending.length, 0);
  assert.equal(recovery.recovered.length, 1);
  assert.equal((await repository.inspectHeads({ userId: "usr_alex", kind: "profile" })).status, "current");
  assert.deepEqual(await repository.recover(), { recovered: [], pending: [], mode: "read-write" });
}));

test("partial synchronization is quarantined as a digest failure during recovery", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({
    workspaceRoot: workspace, localStateRoot: local, actor,
    fault: async (point) => { if (point === "after_journal") throw new Error("simulated provider interruption"); }
  });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_partial", payload: { preference: "text" } }));
  await writeFile(path.join(workspace, "users", "usr_alex", "profile", "records", "pro_partial.json"), "{}\n");
  await assert.rejects(repository.recover(), { code: "digest_mismatch" });
  assert.deepEqual(await repository.inspectHeads({ userId: "usr_alex", kind: "profile" }), { status: "empty", current: [], caseId: null });
}));

test("evidence projections rebuild completely after machine-local cache deletion", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  await repository.publish({ userId: "usr_alex", kind: "evidence", recordId: "evt_second", payload: { event_id: "evt_second", score: 2 } });
  await repository.publish({ userId: "usr_alex", kind: "evidence", recordId: "evt_first", payload: { event_id: "evt_first", score: 1 } });
  await rm(local, { recursive: true, force: true });
  await mkdir(local);
  assert.deepEqual(await repository.rebuildEvidenceProjection({ userId: "usr_alex", project: (events) => ({ total: events.reduce((sum, event) => sum + event.score, 0), ids: events.map((event) => event.event_id) }) }), {
    total: 3, ids: ["evt_first", "evt_second"]
  });
}));

test("future workspace versions are readable only with an actionable diagnostic", async () => withFixture(async ({ workspace, local, actor }) => {
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  assert.equal(repository.descriptor.mode, "read-only");
  assert.match(repository.descriptor.diagnostic, /upgrade/i);
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "profile", recordId: "pro_future", payload: {} }), { code: "read_only_version" });
}, { version: 2 }));

test("portable normalization rejects Windows-reserved, case-risk, and decomposed fixtures", () => {
  for (const platform of ["win32", "darwin", "linux"]) assert.equal(normalizePortableSegment("curriculum-01", { platform }), "curriculum-01");
  for (const segment of ["CON", "aux.txt", "trailing.", "trailing ", "case:collision", "e\u0301"]) {
    assert.throws(() => normalizePortableSegment(segment, { platform: "win32" }), RepositoryError);
  }
});

test("symlink roots and workspace descendants are rejected", async (t) => withFixture(async ({ base, workspace, local, actor }) => {
  const linkedRoot = path.join(base, "linked-root");
  try { await symlink(workspace, linkedRoot, "junction"); } catch (error) { t.skip(`symlink unavailable: ${error.code}`); return; }
  await assert.rejects(openWorkspaceRepository({ workspaceRoot: linkedRoot, localStateRoot: local, actor }), { code: "symlink_root" });
  await mkdir(path.join(workspace, "users"));
  await symlink(base, path.join(workspace, "users", "usr_alex"), "junction");
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  await assert.rejects(repository.publish({ userId: "usr_alex", kind: "evidence", recordId: "evt_escape", payload: {} }), { code: "symlink_escape" });
}));
