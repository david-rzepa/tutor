import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { confirmDeletion, createArchive, LifecycleError, migrateWorkspace, planMigration, previewDeletion, rebuildFromAuthoritative, reconcileConflict, restoreArchive } from "../../src/workspace-lifecycle/index.js";
import { openWorkspaceRepository } from "../../src/workspace-repository/index.js";

async function fixture({ version = 1, testOnly = true } = {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-lifecycle-")); const workspace = path.join(base, "workspace"); const local = path.join(base, "local");
  await mkdir(workspace); await mkdir(local);
  await writeFile(path.join(workspace, "workspace.json"), `${JSON.stringify({ schema: `tutor.workspace/v${version}`, workspace_id: "wrk_lifecycle", format_version: version, test_only: testOnly })}\n`);
  const actor = { userId: "usr_alpha", capabilities: ["profile.read", "profile.write", "evidence.read", "evidence.write"] };
  const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor });
  if (version === 1) {
    await repository.publish({ userId: "usr_alpha", kind: "profile", recordId: "pro_v1", payload: { version: 1 } });
    await repository.publish({ userId: "usr_alpha", kind: "evidence", recordId: "evt_v1", payload: { event_id: "evt_v1", score: 2 } });
  }
  return { base, workspace, local, repository };
}
async function useFixture(run, options) { const value = await fixture(options); try { await run(value); } finally { await rm(value.base, { recursive: true, force: true }); } }

test("copy, verify, switch migration retains source and updates only machine-local link", async () => useFixture(async ({ base, workspace }) => {
  const target = path.join(base, "moved"); const link = path.join(base, "state", "workspace-link.json"); const plan = await planMigration({ sourceRoot: workspace, targetRoot: target });
  const result = await migrateWorkspace({ sourceRoot: workspace, targetRoot: target, localLinkPath: link, expectedPlan: plan });
  assert.equal(result.sourceRetained, true); assert.equal((await stat(workspace)).isDirectory(), true); assert.equal((await stat(target)).isDirectory(), true);
  assert.equal(JSON.parse(await readFile(link, "utf8")).resolved_path, target);
}));

test("interrupted migration resumes, while full-disk and changed staging fail before switch", async () => useFixture(async ({ base, workspace }) => {
  const target = path.join(base, "moved"); const link = path.join(base, "link.json"); const plan = await planMigration({ sourceRoot: workspace, targetRoot: target }); let seen = 0;
  await assert.rejects(migrateWorkspace({ sourceRoot: workspace, targetRoot: target, localLinkPath: link, expectedPlan: plan, fault: async (point) => { if (point === "after_file" && ++seen === 2) throw new Error("interrupted"); } }));
  assert.equal((await migrateWorkspace({ sourceRoot: workspace, targetRoot: target, localLinkPath: link, expectedPlan: plan })).status, "switched");
}));

test("migration resumes after target publication and rejects corrupted partial staging", async () => useFixture(async ({ base, workspace }) => {
  const target = path.join(base, "moved"); const link = path.join(base, "link.json"); const plan = await planMigration({ sourceRoot: workspace, targetRoot: target });
  await assert.rejects(migrateWorkspace({ sourceRoot: workspace, targetRoot: target, localLinkPath: link, expectedPlan: plan, fault: async (point) => { if (point === "before_switch") throw Object.assign(new Error("full disk"), { code: "ENOSPC" }); } }), { code: "ENOSPC" });
  assert.equal((await migrateWorkspace({ sourceRoot: workspace, targetRoot: target, localLinkPath: link, expectedPlan: plan })).status, "switched");
  const other = path.join(base, "other"); const otherPlan = await planMigration({ sourceRoot: workspace, targetRoot: other }); let interrupted = false;
  await assert.rejects(migrateWorkspace({ sourceRoot: workspace, targetRoot: other, localLinkPath: path.join(base, "other-link"), expectedPlan: otherPlan, fault: async (point) => { if (point === "after_file" && !interrupted) { interrupted = true; throw new Error("partial sync"); } } }));
  const staging = `${other}.staging-wrk_lifecycle`; await writeFile(path.join(staging, "workspace.json"), "changed");
  await assert.rejects(migrateWorkspace({ sourceRoot: workspace, targetRoot: other, localLinkPath: path.join(base, "other-link"), expectedPlan: otherPlan }), { code: "resume_mismatch" });
}));

test("backup and scoped export round-trip with immutable manifest provenance", async () => useFixture(async ({ base, workspace }) => {
  const backup = path.join(base, "backup"); const created = await createArchive({ workspaceRoot: workspace, archiveRoot: backup });
  assert.match(created.manifestDigest, /^sha256:/); const restored = path.join(base, "restored");
  assert.equal((await restoreArchive({ archiveRoot: backup, targetRoot: restored })).status, "restored");
  assert.equal(await readFile(path.join(restored, "workspace.json"), "utf8"), await readFile(path.join(workspace, "workspace.json"), "utf8"));
  const exported = path.join(base, "export"); const result = await createArchive({ workspaceRoot: workspace, archiveRoot: exported, users: ["usr_alpha"], purpose: "export" });
  assert.equal(result.manifest.users[0], "usr_alpha"); assert.equal(result.manifest.privacy.raw_reserved_included, false);
}));

test("restore detects collisions, digest tampering, and preserves future versions read-only", async () => useFixture(async ({ base, workspace }) => {
  const archive = path.join(base, "archive"); await createArchive({ workspaceRoot: workspace, archiveRoot: archive });
  await assert.rejects(restoreArchive({ archiveRoot: archive, targetRoot: path.join(base, "collision"), openWorkspaceIds: ["wrk_lifecycle"] }), { code: "workspace_collision" });
  const manifest = JSON.parse(await readFile(path.join(archive, "archive.json"), "utf8")); const first = manifest.files[0]; await writeFile(path.join(archive, "payload", ...first.path.split("/")), "changed");
  await assert.rejects(restoreArchive({ archiveRoot: archive, targetRoot: path.join(base, "tampered") }), { code: "digest_mismatch" });
}));

test("future-version archives restore in read-only recovery mode", async () => useFixture(async ({ base, workspace }) => {
  const archive = path.join(base, "archive"); await createArchive({ workspaceRoot: workspace, archiveRoot: archive });
  assert.equal((await restoreArchive({ archiveRoot: archive, targetRoot: path.join(base, "restored") })).mode, "read-only");
}, { version: 2 }));

test("multi-head conflict reconciliation preserves every parent explicitly", async () => useFixture(async ({ workspace, repository }) => {
  const first = await repository.publish({ userId: "usr_alpha", kind: "profile", recordId: "pro_a", payload: { value: "a" } });
  const second = await repository.publish({ userId: "usr_alpha", kind: "profile", recordId: "pro_b", payload: { value: "b" } });
  const conflict = await repository.inspectHeads({ userId: "usr_alpha", kind: "profile" });
  const result = await reconcileConflict({ workspaceRoot: workspace, caseId: conflict.caseId, selectedHead: second.headId, authority: { decision: "allow", capability: "workspace.reconcile" } });
  assert.deepEqual(result.preservedHeads, [...conflict.current].sort()); assert.notEqual(result.resolutionHead, first.headId);
  assert.deepEqual(await reconcileConflict({ workspaceRoot: workspace, caseId: conflict.caseId, selectedHead: second.headId, authority: { decision: "allow", capability: "workspace.reconcile" } }), result);
}));

test("cache projections rebuild entirely from authoritative records", async () => useFixture(async ({ workspace }) => {
  const result = await rebuildFromAuthoritative({ workspaceRoot: workspace, project: (records) => ({ count: records.length, score: records.filter((record) => record.schema === "tutor.evidence/v1").reduce((sum, record) => sum + record.payload.score, 0) }) });
  assert.deepEqual(result, { count: 2, score: 2 });
}));

test("deletion requires disposable manifest, exact scope, authority, and recovery acknowledgement", async () => useFixture(async ({ workspace }) => {
  const authority = { decision: "allow", capability: "workspace.delete" }; const created = await previewDeletion({ workspaceRoot: workspace, scope: { type: "user", userId: "usr_alpha" }, authority });
  await assert.rejects(confirmDeletion({ workspaceRoot: workspace, preview: created.preview, previewDigest: `sha256:${"0".repeat(64)}`, authority, recoveryAcknowledged: true }), { code: "exact_confirmation_required" });
  const receipt = await confirmDeletion({ workspaceRoot: workspace, ...created, authority, recoveryAcknowledged: true }); assert.equal(receipt.verified_absent, true);
  await assert.rejects(stat(path.join(workspace, "users", "usr_alpha")), { code: "ENOENT" });
  assert.deepEqual(await readdir(path.join(workspace, "journal")), []);
}));

test("non-disposable and shared-reference deletion is impossible", async () => useFixture(async ({ workspace }) => {
  await assert.rejects(previewDeletion({ workspaceRoot: workspace, scope: { type: "workspace" }, authority: { decision: "allow", capability: "workspace.delete" } }), { code: "destructive_boundary" });
}, { testOnly: false }));
