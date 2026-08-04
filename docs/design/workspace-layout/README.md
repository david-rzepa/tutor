# Portable workspace layout

The tutor uses two roots:

- **WorkspaceRoot:** selected and owned by the user; durable, portable data and approved modules for one or multiple users. It may be a normal folder or a sync-managed folder such as Google Drive.
- **LocalStateRoot:** machine-local and rebuildable; caches, locks, sockets, transient logs, staging, and runtime files. It is never required to reconstruct learning state.

A sync provider is transport, not a database, lock service, privacy authority, or backup. The design therefore uses immutable records, stable relative identifiers, versioned heads, explicit conflicts, and recoverable migrations.

## Decision order

1. Preserve user ownership, safety, privacy, isolation, and deletion rights.
2. Preserve durable evidence and provenance; never silently choose between concurrent edits.
3. Remain portable without absolute paths or provider APIs.
4. Keep runtime/cache state replaceable and outside the portable root.
5. Optimize convenience only within those boundaries.

## Load map

| Need | Load |
|---|---|
| Exact directory structure and path rules | [TREE.md](TREE.md) |
| Root/profile/module manifest contracts | [MANIFESTS.md](MANIFESTS.md) |
| Read/write/privacy/retention authority | [DATA-ZONES.md](DATA-ZONES.md) |
| Google Drive-style sync, concurrency, and conflicts | [SYNC-CONCURRENCY.md](SYNC-CONCURRENCY.md) |
| Selection, migration, backup, deletion, and recovery | [LIFECYCLE.md](LIFECYCLE.md) |
| Synthetic failure and threat checks | [VALIDATION.md](VALIDATION.md) |
| Implement the host against this design | [IMPLEMENTATION-HANDOFF.md](IMPLEMENTATION-HANDOFF.md) |

## Boundaries

- The application/harness executable is installed independently. Workspace modules are versioned content/code artifacts loaded only through the harness sandbox.
- Assistants never receive filesystem paths or unrestricted filesystem access; the trusted host resolves capability-scoped identifiers.
- A reserved raw-feedback directory is not collection authority. Goal #5 blocker B-001 continues to prohibit real transcript collection or retention.
- Existing research privacy, child safety, and learner-control rules remain authoritative: [privacy feedback](../../research/learning-design/PRIVACY-FEEDBACK.md) and [learner onboarding](../../research/learning-design/LEARNER-MODEL.md#onboarding-sequence).
