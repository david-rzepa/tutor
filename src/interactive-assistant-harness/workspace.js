import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const ID_PATTERN = /^[a-z][a-z0-9_-]{2,79}$/;

export class WorkspaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

function assertId(value, label) {
  if (!ID_PATTERN.test(value) || value === "." || value === "..") throw new WorkspaceError("invalid_id", `${label} is not a safe opaque ID`);
}

export async function validateWorkspaceRoot(root) {
  const selectedRootStat = await lstat(root);
  if (selectedRootStat.isSymbolicLink()) throw new WorkspaceError("symlink_root", "Workspace root cannot be a symbolic link or junction");
  const canonical = await realpath(root);
  const rootStat = await stat(canonical);
  if (!rootStat.isDirectory()) throw new WorkspaceError("invalid_root", "Workspace root is not a directory");
  const manifestPath = await resolveWorkspacePath(canonical, "workspace.json", { mustExist: true });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "tutor.workspace/v1" || !ID_PATTERN.test(manifest.workspace_id)) {
    throw new WorkspaceError("invalid_manifest", "Unsupported workspace manifest or unsafe workspace ID");
  }
  return { root: canonical, manifest };
}

export async function resolveWorkspacePath(root, relative, { mustExist = false } = {}) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || relative.includes("\\") || relative.includes("\0")) {
    throw new WorkspaceError("unsafe_path", "Workspace path must be a safe relative POSIX path");
  }
  const parts = relative.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.endsWith(".") || part.endsWith(" "))) {
    throw new WorkspaceError("unsafe_path", "Workspace path contains an unsafe segment");
  }
  const canonicalRoot = await realpath(root);
  const candidate = path.resolve(canonicalRoot, ...parts);
  const rel = path.relative(canonicalRoot, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new WorkspaceError("path_escape", "Workspace path escapes its root");
  let ancestor = canonicalRoot;
  for (const part of parts) {
    ancestor = path.join(ancestor, part);
    try {
      const ancestorStat = await lstat(ancestor);
      if (ancestorStat.isSymbolicLink()) throw new WorkspaceError("symlink_escape", "Workspace path crosses a symbolic link or junction");
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
  if (mustExist) {
    const canonicalCandidate = await realpath(candidate);
    const canonicalRel = path.relative(canonicalRoot, canonicalCandidate);
    if (canonicalRel.startsWith("..") || path.isAbsolute(canonicalRel)) throw new WorkspaceError("symlink_escape", "Workspace path resolves outside its root");
  }
  return candidate;
}

export async function writeCheckpoint({ workspaceRoot, localStateRoot, userId, sessionId, checkpoint }) {
  assertId(userId, "userId");
  assertId(sessionId, "sessionId");
  const { root, manifest } = await validateWorkspaceRoot(workspaceRoot);
  const operationId = `op_${randomUUID()}`;
  const checkpointId = `chk_${randomUUID()}`;
  const bytes = `${JSON.stringify({ ...checkpoint, workspace_id: manifest.workspace_id, user_id: userId, checkpoint_id: checkpointId })}\n`;
  const digest = createHash("sha256").update(bytes).digest("hex");
  const stagingDir = path.resolve(localStateRoot, "staging", manifest.workspace_id, operationId);
  await mkdir(stagingDir, { recursive: true });
  const staged = path.join(stagingDir, `${checkpointId}.json`);
  await writeFile(staged, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const destinationDir = await resolveWorkspacePath(root, `users/${userId}/sessions/checkpoints/${sessionId}`);
  await mkdir(destinationDir, { recursive: true });
  await resolveWorkspacePath(root, `users/${userId}/sessions/checkpoints/${sessionId}`, { mustExist: true });
  const destination = path.join(destinationDir, `${checkpointId}.json`);
  await copyFile(staged, destination, constants.COPYFILE_EXCL);
  const copied = await readFile(destination);
  if (createHash("sha256").update(copied).digest("hex") !== digest) {
    await rm(destination, { force: true });
    throw new WorkspaceError("digest_mismatch", "Checkpoint changed while publishing");
  }
  await rm(stagingDir, { recursive: true, force: true });
  return { checkpointId, relativePath: path.relative(root, destination).replaceAll("\\", "/"), digest };
}

export async function readCheckpoints({ workspaceRoot, userId, sessionId }) {
  assertId(userId, "userId");
  assertId(sessionId, "sessionId");
  const { root } = await validateWorkspaceRoot(workspaceRoot);
  const directory = await resolveWorkspacePath(root, `users/${userId}/sessions/checkpoints/${sessionId}`);
  try {
    await access(directory);
  } catch {
    return [];
  }
  const names = (await readdir(directory)).filter((name) => /^chk_[a-f0-9-]+\.json$/.test(name)).sort();
  const records = [];
  for (const name of names) records.push(JSON.parse(await readFile(path.join(directory, name), "utf8")));
  return records.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
}
