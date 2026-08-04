# Sync and concurrency

## Storage protocol

1. Validate root and free-space/quota hints; acquire a machine-local advisory lock.
2. Write the complete new file into `LocalStateRoot/staging/<operation-id>`.
3. Flush, hash, validate, and copy to a unique destination name in `WorkspaceRoot`.
4. Flush and re-read/hash the destination where the platform permits.
5. Append an operation journal record referencing inputs/outputs and expected parents.
6. Publish a new uniquely named head or immutable event last.
7. Re-scan for concurrent heads/events; reconcile or surface conflict.
8. Mark the operation complete locally and clean staging after the recovery window.

Local atomic rename may optimize a step on one filesystem but is not assumed to remain atomic after provider synchronization.

## Conflict model

- Immutable objects/events with different IDs merge by set union after schema, digest, authorization, and duplicate-semantic checks.
- Identical IDs with different bytes are corruption/attack, not a merge; quarantine both and preserve source metadata.
- Mutable records publish append-only heads with parent links. One descendant wins only by ancestry, never wall-clock order.
- Concurrent heads attempt a schema-specific safe merge. Disjoint preference edits may merge; goal/authority/privacy/deletion conflicts require user or guardian resolution.
- Provider-created “conflicted copy” names are never parsed as canonical. Move metadata plus bytes into `quarantine/<case-id>` and reconstruct a valid canonical record through reconciliation.
- Deletion uses reviewed tombstone/erasure semantics so an offline device cannot casually resurrect data. Sensitive deletion guarantees must state sync-provider backup/version limitations.

## Provider and offline states

| State | Behavior |
|---|---|
| root unavailable/not hydrated | enter read-only/degraded mode; request hydration/reconnect; never create a replacement root at the same path |
| offline but local files present | allow bounded writes with unique IDs and later reconciliation; disclose sync pending |
| quota/full disk | stop before publishing head; retain verified staging for recovery or discard safely |
| concurrent devices | accept immutable events; detect multi-head mutable conflicts |
| case-only collision | quarantine and require canonical rename; do not trust platform lookup |
| partial module download | digest/manifest validation fails; use installed verified fallback or stop |
| clock skew | logical parent graph and unique IDs govern; timestamps are informational |
| provider rollback/restore | detect missing/unknown heads against local journal; offer reconciliation/import, never silent overwrite |

## Google Drive boundary

Selecting a Google Drive-synced folder requires no Google API. The app cannot promise upload completion, remote deletion, version-history erasure, exclusive locks, or backup. UI must show local durability separately from observed provider-sync hints and recommend independent encrypted backup for important workspaces.
