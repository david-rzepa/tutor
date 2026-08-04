# Workspace repository

Trusted-host storage for portable, user-selected workspaces. The public API exposes typed profile, curriculum, session-summary, and evidence records through opaque IDs; it never exposes a workspace path to assistant modules.

## Guarantees

- immutable, canonical JSON records with SHA-256 verification;
- append-only mutable heads and ancestry-based conflict detection;
- write-ahead journals with idempotent crash recovery;
- strict user/capability checks and raw-transcript reserved-zone denial;
- path confinement, symlink/junction rejection, and portable names;
- read-only opening of unknown future workspace versions;
- disposable evidence projections rebuilt from workspace truth.

Migration, backup/restore, destructive deletion, provider APIs, encryption/key recovery, real transcript storage, and external sharing are separate authority boundaries.
