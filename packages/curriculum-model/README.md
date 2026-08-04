# Curriculum model

Dependency-free v1 contracts and deterministic graph validation for per-user, per-subject curricula.

The public API validates curriculum metadata, immutable DAG versions, structured evidence events, and explicit graph change sets. `validateGraphStructure` derives stable prerequisite edges, reports an exact cycle, topologically sorts by stable node ID, and rejects required nodes that cannot be reached through valid AND-of-OR clauses or scoped waivers.

This package deliberately does not persist records, project learner state, generate curricula, or render UI. IDs are opaque; identity, diagnosis, filesystem paths, and transcripts are forbidden.
