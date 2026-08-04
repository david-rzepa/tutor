# Validation scenarios

Use only synthetic workspaces and profiles.

## Invariants

- Every durable reference resolves within the selected canonical root.
- No filename or registry index contains profile display name, contact detail, diagnosis, credential, or transcript.
- Every mutable current state is derived from a single ancestry-resolved head or is visibly conflicted.
- Every progress event is immutable, uniquely identified, version/provenance-bound, and replayable into the same projection.
- Removing `LocalStateRoot` loses no durable learner state.
- An assistant cannot discover a filesystem path or access a zone outside its protocol grant.
- Unknown schema majors, invalid digests, unlisted module files, and conflicting identical IDs fail closed.

## Synthetic matrix

| Scenario | Expected result |
|---|---|
| two users, two curricula each | opaque directories remain isolated; scoped host cannot cross-read |
| move local root into/out of a sync folder | dry-run copy verifies; local link switches; records unchanged; rollback works |
| two offline devices append progress | unique events union; projections converge independent of arrival order |
| two devices edit same profile goal | concurrent heads detected; no timestamp overwrite; explicit merge/resolution |
| provider makes conflicted copy | file quarantined; canonical parser ignores provider name; recovery preserves both sources |
| partial/zero-byte graph or module | digest validation rejects; reviewed fallback/read-only state |
| crash before/after head publication | orphan cleaned or new head recovered through journal; prior state remains readable |
| full disk during migration | no target activation; source untouched; staging recovery instructions shown |
| symlink/path traversal/case collision | access rejected before read/write; diagnostic contains no private payload |
| delete user while another session is active | session revoked; explicit deletion transaction; no silent resurrection from offline device |
| file appears in `raw-reserved` | validation fails and quarantines without ingesting content |

## Design acceptance

An implementation is not complete until fault injection demonstrates recovery at each publish boundary, property tests generate unsafe paths/conflict graphs, and a clean machine can reconstruct all durable projections from `WorkspaceRoot` alone.
