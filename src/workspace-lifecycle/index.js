import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const SHA = /^sha256:[a-f0-9]{64}$/;
const OMIT = new Set(["cache", "runtime", "credentials", "raw-reserved"]);

export class LifecycleError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "LifecycleError"; this.code = code; this.details = details; }
}

const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const json = (value) => `${JSON.stringify(stable(value))}\n`;
const digestBytes = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const assertId = (value, field) => { if (!ID.test(value)) throw new LifecycleError("invalid_id", `${field} must be an opaque ID`); };

async function recognizedRoot(root) {
  const info = await lstat(root);
  if (info.isSymbolicLink()) throw new LifecycleError("symlink_root", "Lifecycle roots cannot be links or junctions");
  const canonical = await realpath(root);
  if (!(await stat(canonical)).isDirectory()) throw new LifecycleError("invalid_root", "Workspace root must be a directory");
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(canonical, "workspace.json"), "utf8")); } catch { throw new LifecycleError("invalid_manifest", "Recognized workspace manifest is required"); }
  if (typeof manifest.schema !== "string" || !manifest.schema.startsWith("tutor.workspace/v") || !ID.test(manifest.workspace_id)) throw new LifecycleError("invalid_manifest", "Workspace manifest is malformed");
  return { root: canonical, manifest };
}

async function walk(root, relative = "", { users = null, excludeOperational = false } = {}) {
  const directory = path.join(root, ...relative.split("/").filter(Boolean));
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new LifecycleError("symlink_escape", `Workspace contains link: ${entry.name}`);
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const parts = rel.split("/");
    if (excludeOperational && parts.some((part) => OMIT.has(part))) continue;
    if (users && parts[0] === "users" && parts[1] && !users.has(parts[1])) continue;
    if (users && parts[0] !== "users" && rel !== "workspace.json") continue;
    if (entry.isDirectory()) result.push(...await walk(root, rel, { users, excludeOperational }));
    else if (entry.isFile()) {
      const bytes = await readFile(path.join(root, ...parts));
      result.push({ path: rel, bytes: bytes.length, digest: digestBytes(bytes) });
    } else throw new LifecycleError("unsupported_entry", `Unsupported workspace entry: ${rel}`);
  }
  return result;
}

async function verifyInventory(root, inventory) {
  for (const entry of inventory) {
    const bytes = await readFile(path.join(root, ...entry.path.split("/")));
    if (bytes.length !== entry.bytes || digestBytes(bytes) !== entry.digest) throw new LifecycleError("digest_mismatch", `Verification failed: ${entry.path}`);
  }
  return true;
}

async function copyInventory(source, target, inventory, fault = async () => {}) {
  await mkdir(target, { recursive: true });
  for (const entry of inventory) {
    const destination = path.join(target, ...entry.path.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      const existing = await readFile(destination);
      if (digestBytes(existing) !== entry.digest) throw new LifecycleError("resume_mismatch", `Existing staged file differs: ${entry.path}`);
    } catch (error) {
      if (error instanceof LifecycleError) throw error;
      if (error.code !== "ENOENT") throw error;
      await copyFile(path.join(source, ...entry.path.split("/")), destination);
    }
    await fault("after_file", entry.path);
  }
}

export async function planMigration({ sourceRoot, targetRoot }) {
  const source = await recognizedRoot(sourceRoot);
  const target = path.resolve(targetRoot);
  if (target === source.root || target.startsWith(`${source.root}${path.sep}`) || source.root.startsWith(`${target}${path.sep}`)) throw new LifecycleError("nested_target", "Migration target cannot equal or contain the source");
  try { await lstat(target); throw new LifecycleError("target_exists", "Migration target must not already exist"); } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  const inventory = await walk(source.root);
  return stable({ schema: "tutor.migration-plan/v1", workspace_id: source.manifest.workspace_id, source_checkpoint: digestBytes(Buffer.from(json(inventory))), file_count: inventory.length, total_bytes: inventory.reduce((sum, item) => sum + item.bytes, 0), target_name: path.basename(target), source_retained: true, rollback_boundary: "machine_local_link_switch" });
}

export async function migrateWorkspace({ sourceRoot, targetRoot, localLinkPath, expectedPlan, fault = async () => {} }) {
  const source = await recognizedRoot(sourceRoot);
  const target = path.resolve(targetRoot);
  if (target === source.root || target.startsWith(`${source.root}${path.sep}`) || source.root.startsWith(`${target}${path.sep}`)) throw new LifecycleError("nested_target", "Migration target must be separate from the source");
  const inventory = await walk(source.root);
  const currentPlan = stable({ schema: "tutor.migration-plan/v1", workspace_id: source.manifest.workspace_id, source_checkpoint: digestBytes(Buffer.from(json(inventory))), file_count: inventory.length, total_bytes: inventory.reduce((sum, item) => sum + item.bytes, 0), target_name: path.basename(target), source_retained: true, rollback_boundary: "machine_local_link_switch" });
  if (JSON.stringify(currentPlan) !== JSON.stringify(expectedPlan)) throw new LifecycleError("plan_drift", "Migration plan changed before execution");
  const staging = `${target}.staging-${source.manifest.workspace_id}`;
  let published = false;
  try { const info = await lstat(target); if (info.isSymbolicLink() || !info.isDirectory()) throw new LifecycleError("invalid_target", "Published migration target is unsafe"); published = true; } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  if (!published) {
    await copyInventory(source.root, staging, inventory, fault);
    await fault("after_copy");
    await verifyInventory(staging, inventory);
    await fault("after_verify");
    await rename(staging, target);
  }
  await verifyInventory(target, inventory);
  await fault("before_switch");
  await mkdir(path.dirname(localLinkPath), { recursive: true });
  const temporaryLink = `${localLinkPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryLink, json({ schema: "tutor.machine-workspace-link/v1", workspace_id: source.manifest.workspace_id, resolved_path: target }), { flag: "wx", mode: 0o600 });
  await rename(temporaryLink, localLinkPath);
  return { status: "switched", workspaceId: source.manifest.workspace_id, targetRoot: target, sourceRetained: true, inventoryDigest: currentPlan.source_checkpoint };
}

export async function createArchive({ workspaceRoot, archiveRoot, users = null, purpose = "backup", fault = async () => {} }) {
  const source = await recognizedRoot(workspaceRoot);
  const selected = users ? new Set(users) : null;
  if (selected) for (const user of selected) assertId(user, "userId");
  const inventory = await walk(source.root, "", { users: selected, excludeOperational: true });
  const root = path.resolve(archiveRoot);
  try { await lstat(root); throw new LifecycleError("target_exists", "Archive target must be new"); } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  await mkdir(root, { recursive: true });
  await copyInventory(source.root, path.join(root, "payload"), inventory, fault);
  const manifest = stable({ schema: "tutor.workspace-archive/v1", archive_id: `arc_${randomUUID()}`, workspace_id: source.manifest.workspace_id, workspace_schema: source.manifest.schema, purpose, users: selected ? [...selected].sort() : "all", privacy: { raw_reserved_included: false, credentials_included: false }, files: inventory });
  await writeFile(path.join(root, "archive.json"), json(manifest), { flag: "wx", mode: 0o600 });
  await verifyInventory(path.join(root, "payload"), inventory);
  return { manifest, manifestDigest: digestBytes(Buffer.from(json(manifest))) };
}

export async function restoreArchive({ archiveRoot, targetRoot, openWorkspaceIds = [], fault = async () => {} }) {
  const archive = await realpath(archiveRoot);
  const manifest = JSON.parse(await readFile(path.join(archive, "archive.json"), "utf8"));
  if (manifest.schema !== "tutor.workspace-archive/v1" || !ID.test(manifest.workspace_id) || !Array.isArray(manifest.files)) throw new LifecycleError("invalid_archive", "Archive manifest is malformed");
  if (openWorkspaceIds.includes(manifest.workspace_id)) throw new LifecycleError("workspace_collision", "Restore would collide with an open workspace");
  await verifyInventory(path.join(archive, "payload"), manifest.files);
  const target = path.resolve(targetRoot);
  try { await lstat(target); throw new LifecycleError("target_exists", "Restore target must be new"); } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  const staging = `${target}.restore-${manifest.archive_id}`;
  await copyInventory(path.join(archive, "payload"), staging, manifest.files, fault);
  await verifyInventory(staging, manifest.files);
  await rename(staging, target);
  return { status: "restored", workspaceId: manifest.workspace_id, mode: manifest.workspace_schema === "tutor.workspace/v1" ? "read-write" : "read-only" };
}

export async function reconcileConflict({ workspaceRoot, caseId, selectedHead, authority }) {
  assertId(caseId, "caseId"); assertId(selectedHead, "selectedHead");
  if (authority?.decision !== "allow" || authority.capability !== "workspace.reconcile") throw new LifecycleError("authority_denied", "Explicit reconciliation authority is required");
  const { root } = await recognizedRoot(workspaceRoot);
  const conflict = JSON.parse(await readFile(path.join(root, "quarantine", `${caseId}.json`), "utf8"));
  if (!conflict.heads?.includes(selectedHead)) throw new LifecycleError("invalid_resolution", "Selected head is not part of the conflict");
  const directories = { profile: "profile", curriculum: "curricula" };
  if (!directories[conflict.kind]) throw new LifecycleError("invalid_resolution", "Conflict kind cannot publish mutable heads");
  const resolvedPath = path.join(root, "quarantine", `${caseId}.resolved.json`);
  try {
    const existing = JSON.parse(await readFile(resolvedPath, "utf8"));
    if (existing.selected_head !== selectedHead) throw new LifecycleError("resolution_conflict", "Conflict already resolved with a different explicit selection");
    return { status: "reconciled", resolutionHead: existing.resolution_head, preservedHeads: existing.parents };
  } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  const headDir = path.join(root, "users", conflict.user_id, directories[conflict.kind], "heads");
  const selected = JSON.parse(await readFile(path.join(headDir, `${selectedHead}.json`), "utf8"));
  const resolutionId = `hed_${randomUUID()}`;
  const resolution = stable({ ...selected, head_id: resolutionId, parents: [...conflict.heads].sort(), resolution: { case_id: caseId, selected_head: selectedHead, preservation: "all_parents_retained" } });
  await writeFile(path.join(headDir, `${resolutionId}.json`), json(resolution), { flag: "wx", mode: 0o600 });
  await writeFile(resolvedPath, json({ schema: "tutor.conflict-resolution/v1", case_id: caseId, selected_head: selectedHead, resolution_head: resolutionId, parents: resolution.parents }), { flag: "wx", mode: 0o600 });
  return { status: "reconciled", resolutionHead: resolutionId, preservedHeads: resolution.parents };
}

export async function rebuildFromAuthoritative({ workspaceRoot, project }) {
  const { root } = await recognizedRoot(workspaceRoot);
  const inventory = await walk(root, "", { excludeOperational: true });
  const records = [];
  for (const entry of inventory.filter((item) => /\/records\/[^/]+\.json$/.test(item.path))) records.push(JSON.parse(await readFile(path.join(root, ...entry.path.split("/")), "utf8")));
  return project(records.sort((a, b) => `${a.user_id}/${a.record_id}`.localeCompare(`${b.user_id}/${b.record_id}`)));
}

export async function previewDeletion({ workspaceRoot, scope, authority, sharedReferences = [] }) {
  const { root, manifest } = await recognizedRoot(workspaceRoot);
  if (manifest.test_only !== true) throw new LifecycleError("destructive_boundary", "Deletion is implemented only for explicitly disposable test workspaces");
  if (authority?.decision !== "allow" || authority.capability !== "workspace.delete") throw new LifecycleError("authority_denied", "Explicit deletion authority is required");
  if (sharedReferences.length) throw new LifecycleError("shared_reference", "Deletion requires reference reconciliation first");
  let target = root;
  if (scope?.type === "user") { assertId(scope.userId, "userId"); target = path.join(root, "users", scope.userId); }
  else if (scope?.type !== "workspace") throw new LifecycleError("invalid_scope", "Deletion scope must be one user or the disposable workspace");
  const inventory = await walk(target);
  const deletePaths = scope.type === "workspace" ? ["."] : [`users/${scope.userId}`];
  const journalOperations = new Set();
  if (scope.type === "user") for (const zone of ["journal", "quarantine"]) {
    try { for (const name of await readdir(path.join(root, zone))) {
      const relative = `${zone}/${name}`; let record;
      try { record = JSON.parse(await readFile(path.join(root, zone, name), "utf8")); } catch { continue; }
      if (record.user_id === scope.userId) {
        deletePaths.push(relative);
        if (zone === "journal" && typeof record.operation_id === "string") journalOperations.add(record.operation_id);
      }
    } } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const operationId of journalOperations) {
    const completion = `journal/${operationId}.complete.json`;
    try { await lstat(path.join(root, ...completion.split("/"))); deletePaths.push(completion); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const preview = stable({ schema: "tutor.deletion-preview/v1", workspace_id: manifest.workspace_id, scope, target, file_count: inventory.length, total_bytes: inventory.reduce((sum, item) => sum + item.bytes, 0), recovery_boundary: "no_recovery_after_confirmation", provider_limitations: "local test workspace only", files: inventory.map((item) => item.path), delete_paths: [...new Set(deletePaths)].sort() });
  return { preview, previewDigest: digestBytes(Buffer.from(json(preview))) };
}

export async function confirmDeletion({ workspaceRoot, preview, previewDigest, authority, recoveryAcknowledged }) {
  if (!SHA.test(previewDigest) || digestBytes(Buffer.from(json(preview))) !== previewDigest) throw new LifecycleError("exact_confirmation_required", "Exact deletion preview confirmation is required");
  if (!recoveryAcknowledged) throw new LifecycleError("recovery_not_acknowledged", "The recovery boundary must be acknowledged");
  const current = await previewDeletion({ workspaceRoot, scope: preview.scope, authority });
  if (current.previewDigest !== previewDigest) throw new LifecycleError("scope_drift", "Deletion scope changed after preview");
  const { root } = await recognizedRoot(workspaceRoot);
  const targets = preview.delete_paths.map((relative) => relative === "." ? root : path.resolve(root, ...relative.split("/")));
  if (targets.some((target) => target !== root && !target.startsWith(`${root}${path.sep}`))) throw new LifecycleError("scope_drift", "Deletion path escaped the disposable workspace");
  for (const target of targets.sort((a, b) => b.length - a.length)) await rm(target, { recursive: true, force: false });
  for (const target of targets) try { await lstat(target); throw new LifecycleError("deletion_failed", "Deletion target still exists"); } catch (error) { if (error instanceof LifecycleError) throw error; if (error.code !== "ENOENT") throw error; }
  return stable({ schema: "tutor.deletion-receipt/v1", workspace_id: preview.workspace_id, scope: preview.scope, preview_digest: previewDigest, verified_absent: true, privacy: "no_file_names_or_identity" });
}
