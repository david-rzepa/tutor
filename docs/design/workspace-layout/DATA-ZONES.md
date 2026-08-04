# Data zones and authority

| Zone | Typical data | Reader / writer | Portable sync | Retention / deletion |
|---|---|---|---|---|
| root/registry | opaque IDs, versions, logical paths | trusted host; user administration | yes | retained with workspace; rebuilt only from verified records |
| profile objects/heads | goals, age band, preferences, accessibility settings, authority—not unnecessary diagnoses | authorized tutor services; never raw assistant | opt-in default yes; encrypt where threat model requires | user/guardian view, correct, export, delete; version history policy explicit |
| curricula/graphs | subject goals, nodes, prerequisites, provenance | tutor/curriculum services; assistant gets current node slice only | yes | versioned while referenced by evidence; archive/delete under policy |
| progress events | observations, evidence, uncertainty, producing versions | trusted evidence service; assistant emits through host | yes | purpose-limited; deletable with projection rebuild and audit tombstone policy |
| projections | derived mastery/readiness views | tutor and authorized progress UI | optional | disposable/rebuildable; never sole evidence |
| generated assistants | user-tailored code/content with no identity | validator/host; sandbox gets own artifact | configurable | retire by version; delete when unreferenced under provenance policy |
| session checkpoints | minimum state for crash recovery | host only; assistant via protocol slice | configurable, short | expire after completion/recovery window |
| session summaries | compact learning evidence | tutor/evidence service | yes if authorized | follows progress purpose, not transcript retention |
| feedback/derived | minimized structured improvement evidence | private analysis service | off by default until policy | #5 consent/purpose/retention controls |
| feedback/raw-reserved | no data currently permitted | no runtime reader/writer | no | B-001 prohibits collection/retention |
| shared modules/content | reviewed identity-free artifacts | validator/host; assistants get scoped files | yes | versioned, rollback-capable |
| exports | explicit user-selected package | user/export service | user decision | expires or user deletes; never silently generated |
| LocalStateRoot | cache, locks, staging, runtime, redacted diagnostics | current machine host | no | bounded and safely removable; no sole durable state |

## Capability boundary

Assistants exchange protocol messages with the host. They receive opaque `objective_id`, authorized content/rubric, minimal age/access settings, and ephemeral session ID—not paths, root handles, registry contents, identity, other users, credentials, or arbitrary file APIs.

Agents receive only the zones and fields needed for the current purpose. Cross-user analysis and external GitHub issues belong to #5 and require privacy-safe aggregation plus explicit authority. Public artifacts use synthetic reproduction.

## Encryption and secrets

Provider-at-rest encryption does not replace local access control or application-level encryption when the reviewed threat model requires it. Encryption design must include key ownership, recovery, rotation, multi-device access, deletion limits, and locked-state behavior. Keys and provider tokens live in OS credential storage, never `WorkspaceRoot`, logs, modules, exports by default, or repository files.
