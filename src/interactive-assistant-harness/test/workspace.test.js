import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readCheckpoints, resolveWorkspacePath, validateWorkspaceRoot, WorkspaceError, writeCheckpoint } from "../workspace.js";

async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-harness-test-"));
  const workspaceRoot = path.join(base, "workspace");
  const localStateRoot = path.join(base, "local");
  await mkdir(workspaceRoot);
  await writeFile(path.join(workspaceRoot, "workspace.json"), JSON.stringify({ schema: "tutor.workspace/v1", workspace_id: "wrk_synthetic" }));
  return { base, workspaceRoot, localStateRoot };
}

test("opens a recognized user-selected workspace without storing its absolute path", async () => {
  const f = await fixture();
  try {
    const opened = await validateWorkspaceRoot(f.workspaceRoot);
    assert.equal(opened.manifest.workspace_id, "wrk_synthetic");
    assert.equal(JSON.stringify(opened.manifest).includes(f.workspaceRoot), false);
  } finally { await rm(f.base, { recursive: true, force: true }); }
});

test("publishes unique verified checkpoints through machine-local staging", async () => {
  const f = await fixture();
  try {
    const one = await writeCheckpoint({
      workspaceRoot: f.workspaceRoot,
      localStateRoot: f.localStateRoot,
      userId: "usr_synthetic",
      sessionId: "ses_synthetic",
      checkpoint: { schema: "tutor.host-checkpoint/v1", created_at: 1, session: { status: "running" } }
    });
    const two = await writeCheckpoint({
      workspaceRoot: f.workspaceRoot,
      localStateRoot: f.localStateRoot,
      userId: "usr_synthetic",
      sessionId: "ses_synthetic",
      checkpoint: { schema: "tutor.host-checkpoint/v1", created_at: 2, session: { status: "paused" } }
    });
    assert.notEqual(one.checkpointId, two.checkpointId);
    assert.match(one.digest, /^[a-f0-9]{64}$/);
    const records = await readCheckpoints({ workspaceRoot: f.workspaceRoot, userId: "usr_synthetic", sessionId: "ses_synthetic" });
    assert.deepEqual(records.map((record) => record.created_at), [1, 2]);
  } finally { await rm(f.base, { recursive: true, force: true }); }
});

test("rejects traversal, unsafe IDs, unknown manifests, and symlink escape", async (t) => {
  const f = await fixture();
  try {
    await assert.rejects(resolveWorkspacePath(f.workspaceRoot, "../outside"), (error) => error.code === "unsafe_path");
    await assert.rejects(
      writeCheckpoint({ workspaceRoot: f.workspaceRoot, localStateRoot: f.localStateRoot, userId: "../other", sessionId: "ses_ok", checkpoint: {} }),
      (error) => error instanceof WorkspaceError && error.code === "invalid_id"
    );
    await writeFile(path.join(f.workspaceRoot, "workspace.json"), JSON.stringify({ schema: "unknown/v1", workspace_id: "wrk_synthetic" }));
    await assert.rejects(validateWorkspaceRoot(f.workspaceRoot), (error) => error.code === "invalid_manifest");

    await writeFile(path.join(f.workspaceRoot, "workspace.json"), JSON.stringify({ schema: "tutor.workspace/v1", workspace_id: "wrk_synthetic" }));
    const outside = path.join(f.base, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "private.json"), "private");
    try { await symlink(outside, path.join(f.workspaceRoot, "escape"), "junction"); }
    catch { t.skip("symlink creation is unavailable on this platform"); return; }
    await assert.rejects(resolveWorkspacePath(f.workspaceRoot, "escape/private.json"), (error) => error.code === "symlink_escape");
  } finally { await rm(f.base, { recursive: true, force: true }); }
});
