# Implementation handoff

## Host integration (#7)

Implement a workspace service behind the trusted host; assistants see only typed capability methods and opaque IDs.

1. Root selection/preflight and machine-local workspace links.
2. Strict path/manifest/schema/digest validation and safe read-only open.
3. Immutable object/event writer, unique head publisher, journal, checkpoint, and crash recovery.
4. Profile/curriculum/session/evidence repositories with per-user authorization.
5. Conflict detector/quarantine and explicit reconciliation API.
6. Copy/verify/switch migration plus backup/export/restore primitives.
7. Cache/projection rebuild and secure deletion orchestration.

## Required tests

- Windows/macOS/Linux path normalization, reserved names, case and symlink/reparse escapes;
- deterministic schemas and digest verification;
- concurrent immutable event convergence and multi-head detection;
- injected crash/full-disk/partial-sync at every publish boundary;
- workspace move rollback and unknown-version read-only behavior;
- cross-user/cross-zone denial and module capability isolation;
- removal of LocalStateRoot followed by complete rebuild;
- raw-reserved rejection while #5 B-001 remains open.

## Curriculum integration (#10)

Each curriculum lives at `users/<user-id>/curricula/<curriculum-id>` and uses immutable graph versions plus immutable progress events. The DAG design owns graph schemas and readiness semantics; this design owns identifiers, paths, version publication, sync conflicts, retention, and portability.

## Decisions requiring separate authority

Application-level encryption/key recovery, real transcript storage, provider API integration, production deployment, external sharing/writes, and destructive migration/deletion need their reviewed design and user authority. The generic directory contract does not authorize them.
