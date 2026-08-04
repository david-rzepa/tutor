# Workspace lifecycle

## Create or select

1. User chooses a new/empty folder or explicitly imports an existing recognized workspace.
2. Preflight canonical path, permissions, symlink/reparse boundaries, free space, case behavior, schema compatibility, partial-sync indicators, and nested-workspace hazards.
3. Show what will be stored, sync/privacy implications, LocalStateRoot location, and recovery expectations.
4. Create in staging, validate, then publish `workspace.json` last. Never adopt arbitrary existing files silently.

## Open

Verify root schema/ID, paths, manifests, heads, digests, journals, and unresolved quarantine. Build disposable indexes/projections locally. If critical records are missing or partially hydrated, use explicit degraded/read-only mode rather than fabricating defaults.

## Move root

Migration is a copy/verify/switch operation, never an in-place guess:

1. pause durable writes and record source checkpoint;
2. preflight target and produce a dry-run plan;
3. copy into a uniquely named target staging folder;
4. verify every manifest, digest, reference, permission expectation, and record count;
5. open target read-only and rebuild projections;
6. atomically switch only the machine-local workspace link;
7. retain source unchanged through the declared rollback window;
8. delete source only through a separate explicit user action.

No portable file changes merely because the absolute root changed.

## Schema migration

Migrations declare from/to versions, prerequisites, affected zones, space estimate, reversible boundary, validators, and recovery instructions. Never mutate the only copy: create new objects/heads, validate a synthetic and actual dry run, checkpoint, then activate the new root format. Unknown future majors open read-only.

## Backup, export, restore

- Backup is a consistent manifest listing all included digests plus privacy/encryption metadata; sync alone is not labeled backup.
- Export is explicit, purpose-scoped, previewable, and excludes cache, credentials, raw-reserved content, and other users unless selected.
- Restore lands in staging/new root, validates, detects workspace-ID collision/fork, and never overwrites an open workspace.

## Delete user/workspace

Preview scope and provider limitations; revoke active sessions; write authorized deletion intent; remove indexes, durable objects per retention/legal authority, projections, exports, keys, and local caches; verify; produce a privacy-safe receipt. Do not recursively delete an unresolved path. Another user’s shared/referenced objects require reference-aware handling.
