import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const KINDS = new Map([
  ["profile", { directory: "profile", mutable: true }],
  ["curriculum", { directory: "curricula", mutable: true }],
  ["session-summary", { directory: "session-summaries", mutable: false }],
  ["evidence", { directory: "evidence", mutable: false }]
]);
const FORBIDDEN_KEYS = /^(transcript|raw_transcript|chat_messages|display_name|email|diagnosis|absolute_path)$/i;

export class RepositoryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.details = details;
  }
}

function assertId(value, label) {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new RepositoryError("invalid_id", `${label} must be an opaque lowercase ID`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function bytes(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function hash(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function validatePayload(value, trail = "payload") {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return;
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new RepositoryError("payload_too_large", `${trail} has too many entries`);
    value.forEach((entry, index) => validatePayload(entry, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new RepositoryError("invalid_payload", `${trail} must contain JSON values only`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new RepositoryError("raw_reserved", `${trail}.${key} is reserved for separately authorized data handling`);
    validatePayload(entry, `${trail}.${key}`);
  }
}

export function normalizePortableSegment(segment, { platform = process.platform } = {}) {
  if (typeof segment !== "string" || !segment || segment === "." || segment === ".." || segment.includes("\0") || /[\\/]/.test(segment)) {
    throw new RepositoryError("unsafe_path", "Path segment is not portable");
  }
  const normalized = segment.normalize("NFC");
  if (normalized !== segment || segment.endsWith(".") || segment.endsWith(" ") || /[<>:\"|?*]/.test(segment) || RESERVED.test(segment)) {
    throw new RepositoryError("nonportable_path", `Path segment is unsafe on ${platform}`);
  }
  return normalized;
}

async function confined(root, segments, { exists = false } = {}) {
  const canonicalRoot = await realpath(root);
  const safe = segments.map((segment) => normalizePortableSegment(segment));
  const candidate = path.resolve(canonicalRoot, ...safe);
  const relative = path.relative(canonicalRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new RepositoryError("path_escape", "Path escapes workspace root");
  let cursor = canonicalRoot;
  for (const segment of safe) {
    cursor = path.join(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new RepositoryError("symlink_escape", "Workspace paths cannot cross links or junctions");
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      if (error.code === "ENOENT") break;
      throw error;
    }
  }
  if (exists) {
    const resolved = await realpath(candidate);
    const resolvedRelative = path.relative(canonicalRoot, resolved);
    if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) throw new RepositoryError("symlink_escape", "Resolved path escapes workspace root");
  }
  return candidate;
}

async function writeExclusive(target, content) {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(target, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if ((await readFile(target, "utf8")) !== content) throw new RepositoryError("identity_collision", "An immutable ID has different bytes");
  }
}

async function readJson(target, code = "invalid_record") {
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new RepositoryError("not_found", "Record does not exist");
    if (error instanceof SyntaxError) throw new RepositoryError(code, "Record is not valid JSON");
    throw error;
  }
}

function kindContract(kind) {
  const contract = KINDS.get(kind);
  if (!contract) throw new RepositoryError("unknown_kind", `Unknown repository kind: ${kind}`);
  return contract;
}

function authorize(actor, userId, kind, operation) {
  assertId(userId, "userId");
  if (!actor || actor.userId !== userId) throw new RepositoryError("cross_user_denied", "Repository access is limited to the authorized user");
  const capability = `${kind}.${operation}`;
  if (!new Set(actor.capabilities ?? []).has(capability)) throw new RepositoryError("capability_denied", `Missing capability: ${capability}`);
}

async function listJson(directory) {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function openWorkspaceRepository({ workspaceRoot, localStateRoot, actor, fault = async () => {} }) {
  const selected = await lstat(workspaceRoot);
  if (selected.isSymbolicLink()) throw new RepositoryError("symlink_root", "Workspace root cannot be a link or junction");
  const root = await realpath(workspaceRoot);
  if (!(await stat(root)).isDirectory()) throw new RepositoryError("invalid_root", "Workspace root must be a directory");
  const manifest = await readJson(await confined(root, ["workspace.json"], { exists: true }), "invalid_manifest");
  assertId(manifest.workspace_id, "workspace_id");
  const supported = manifest.schema === "tutor.workspace/v1" && manifest.format_version === 1;
  if (typeof manifest.schema !== "string" || !manifest.schema.startsWith("tutor.workspace/v") || !Number.isInteger(manifest.format_version)) {
    throw new RepositoryError("invalid_manifest", "Workspace manifest is malformed");
  }
  if (!localStateRoot) throw new RepositoryError("local_state_required", "Machine-local staging is required");

  const descriptor = Object.freeze({
    workspaceId: manifest.workspace_id,
    mode: supported ? "read-write" : "read-only",
    diagnostic: supported ? null : `Workspace ${manifest.schema} format ${manifest.format_version} is newer than this host; upgrade to enable writes.`
  });

  async function immutablePath(userId, kind, recordId) {
    const { directory } = kindContract(kind);
    return confined(root, ["users", userId, directory, "records", `${recordId}.json`]);
  }

  async function publish({ userId, kind, recordId, payload, parents = [], deviceId = "dev_local" }) {
    if (!supported) throw new RepositoryError("read_only_version", descriptor.diagnostic);
    const contract = kindContract(kind);
    authorize(actor, userId, kind, "write");
    assertId(recordId, "recordId");
    assertId(deviceId, "deviceId");
    if (!Array.isArray(parents) || parents.some((entry) => typeof entry !== "string" || !ID.test(entry))) {
      throw new RepositoryError("invalid_parents", "Parent heads must be opaque IDs");
    }
    validatePayload(payload);
    const operationId = `op_${randomUUID()}`;
    const object = { schema: `tutor.${kind}/v1`, workspace_id: manifest.workspace_id, user_id: userId, record_id: recordId, payload };
    const objectBytes = bytes(object);
    if (Buffer.byteLength(objectBytes) > 1_000_000) throw new RepositoryError("payload_too_large", "Record exceeds one megabyte");
    const objectDigest = hash(objectBytes);
    const staging = path.resolve(localStateRoot, "staging", manifest.workspace_id, operationId);
    await mkdir(staging, { recursive: true });
    const stagedObject = path.join(staging, "object.json");
    await writeFile(stagedObject, objectBytes, { flag: "wx", mode: 0o600 });
    await fault("after_stage");
    const destination = await immutablePath(userId, kind, recordId);
    await writeExclusive(destination, objectBytes);
    if (hash(await readFile(destination, "utf8")) !== objectDigest) throw new RepositoryError("digest_mismatch", "Published object failed verification");
    await fault("after_object");

    const headId = contract.mutable ? `hed_${randomUUID()}` : null;
    const journal = {
      schema: "tutor.journal/v1", operation_id: operationId, user_id: userId, kind, record_id: recordId,
      object: objectDigest, parents, device_id: deviceId, mutable: contract.mutable, head_id: headId
    };
    const journalPath = await confined(root, ["journal", `${operationId}.json`]);
    await writeExclusive(journalPath, bytes(journal));
    await fault("after_journal");
    if (contract.mutable) {
      const head = {
        schema: "tutor.head/v1", head_id: headId, record_type: kind, record_id: recordId,
        object: objectDigest, parents: [...parents].sort(), device_id: deviceId
      };
      await fault("before_head");
      const headPath = await confined(root, ["users", userId, contract.directory, "heads", `${headId}.json`]);
      await writeExclusive(headPath, bytes(head));
    }
    await writeExclusive(await confined(root, ["journal", `${operationId}.complete.json`]), bytes({ schema: "tutor.journal-complete/v1", operation_id: operationId }));
    await rm(staging, { recursive: true, force: true });
    return { recordId, digest: objectDigest, headId };
  }

  async function read({ userId, kind, recordId, expectedDigest = null }) {
    kindContract(kind);
    authorize(actor, userId, kind, "read");
    assertId(recordId, "recordId");
    if (expectedDigest !== null && !DIGEST.test(expectedDigest)) throw new RepositoryError("invalid_digest", "Expected digest must be SHA-256");
    const target = await immutablePath(userId, kind, recordId);
    const content = await readFile(target, "utf8");
    const record = JSON.parse(content);
    if (record.schema !== `tutor.${kind}/v1` || record.workspace_id !== manifest.workspace_id || record.user_id !== userId || record.record_id !== recordId) {
      throw new RepositoryError("record_identity_mismatch", "Stored record does not match its repository identity");
    }
    if (expectedDigest && hash(content) !== expectedDigest) throw new RepositoryError("digest_mismatch", "Stored record does not match the expected digest");
    return record;
  }

  async function inspectHeads({ userId, kind }) {
    const contract = kindContract(kind);
    authorize(actor, userId, kind, "read");
    if (!contract.mutable) throw new RepositoryError("immutable_kind", `${kind} does not publish heads`);
    const directory = await confined(root, ["users", userId, contract.directory, "heads"]);
    const heads = [];
    for (const name of await listJson(directory)) heads.push(await readJson(path.join(directory, name)));
    const ids = new Set(heads.map((head) => head.head_id));
    const referenced = new Set(heads.flatMap((head) => head.parents ?? []).filter((id) => ids.has(id)));
    const current = heads.filter((head) => !referenced.has(head.head_id));
    if (current.length > 1) {
      const caseId = `case_${hash(bytes(current.map((head) => head.head_id).sort())).slice(7, 23)}`;
      const quarantine = { schema: "tutor.conflict/v1", case_id: caseId, user_id: userId, kind, heads: current.map((head) => head.head_id).sort() };
      await writeExclusive(await confined(root, ["quarantine", `${caseId}.json`]), bytes(quarantine));
      return { status: "conflict", current: quarantine.heads, caseId };
    }
    return { status: current.length ? "current" : "empty", current: current.map((head) => head.head_id), caseId: null };
  }

  async function recover() {
    if (!supported) return { recovered: [], pending: [], mode: "read-only" };
    const journalDir = await confined(root, ["journal"]);
    const names = (await listJson(journalDir)).filter((name) => !name.endsWith(".complete.json"));
    const recovered = [];
    const pending = [];
    for (const name of names) {
      const operation = await readJson(path.join(journalDir, name));
      const complete = path.join(journalDir, name.replace(/\.json$/, ".complete.json"));
      try { await stat(complete); continue; } catch (error) { if (error.code !== "ENOENT") throw error; }
      const destination = await immutablePath(operation.user_id, operation.kind, operation.record_id);
      try {
        const content = await readFile(destination, "utf8");
        if (hash(content) !== operation.object) throw new RepositoryError("digest_mismatch", "Recovery found changed immutable bytes");
      } catch (error) {
        if (error.code === "ENOENT") { pending.push(operation.operation_id); continue; }
        else throw error;
      }
      if (operation.mutable) {
        authorize(actor, operation.user_id, operation.kind, "write");
        assertId(operation.head_id, "head_id");
        const contract = kindContract(operation.kind);
        const head = {
          schema: "tutor.head/v1", head_id: operation.head_id, record_type: operation.kind,
          record_id: operation.record_id, object: operation.object,
          parents: [...operation.parents].sort(), device_id: operation.device_id
        };
        await writeExclusive(await confined(root, ["users", operation.user_id, contract.directory, "heads", `${operation.head_id}.json`]), bytes(head));
      }
      await writeExclusive(complete, bytes({ schema: "tutor.journal-complete/v1", operation_id: operation.operation_id }));
      recovered.push(operation.operation_id);
    }
    return { recovered, pending, mode: "read-write" };
  }

  async function rebuildEvidenceProjection({ userId, project }) {
    authorize(actor, userId, "evidence", "read");
    const directory = await confined(root, ["users", userId, "evidence", "records"]);
    const events = [];
    for (const name of await listJson(directory)) events.push((await readJson(path.join(directory, name))).payload);
    return project(events.sort((a, b) => String(a.event_id).localeCompare(String(b.event_id))));
  }

  return Object.freeze({ descriptor, publish, read, inspectHeads, recover, rebuildEvidenceProjection });
}

export function createAssistantModuleCapabilities({ emit }) {
  if (typeof emit !== "function") throw new RepositoryError("invalid_capability", "Module event emitter is required");
  return Object.freeze({
    recordAttempt: (event) => emit("attempt.recorded", stable(event)),
    requestAdaptation: (request) => emit("adaptation.requested", stable(request))
  });
}
