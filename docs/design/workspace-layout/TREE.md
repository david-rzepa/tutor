# Directory tree and path rules

```text
WorkspaceRoot/
├── workspace.json
├── users/
│   └── usr_<uuid>/
│       ├── profile/
│       │   ├── heads/<head-id>.json
│       │   └── objects/<sha256>.json
│       ├── curricula/
│       │   └── cur_<uuid>/
│       │       ├── curriculum.json
│       │       ├── graph/<version>.json
│       │       └── progress/
│       │           ├── events/<yyyy-mm>/<event-id>.json
│       │           └── projections/<projection-id>.json
│       ├── assistants/
│       │   └── generated/<assistant-id>/<version>/
│       │       ├── manifest.json
│       │       └── assets/...
│       ├── sessions/
│       │   ├── checkpoints/<session-id>/<checkpoint-id>.json
│       │   └── summaries/<yyyy-mm>/<session-id>.json
│       ├── feedback/
│       │   ├── derived/<yyyy-mm>/<record-id>.json
│       │   └── raw-reserved/README.md
│       └── exports/<export-id>/manifest.json
├── shared/
│   ├── assistants/<assistant-id>/<version>/manifest.json
│   ├── curriculum-templates/<template-id>/<version>/manifest.json
│   └── content/<content-id>/<version>/manifest.json
├── registry/
│   ├── users.json
│   └── modules.json
├── migrations/<migration-id>/manifest.json
├── journal/<yyyy-mm>/<operation-id>.json
└── quarantine/<case-id>/manifest.json

LocalStateRoot/
├── workspace-links/<workspace-id>.json
├── cache/<workspace-id>/...
├── locks/<workspace-id>/...
├── staging/<workspace-id>/<operation-id>/...
├── runtime/<workspace-id>/...
└── diagnostics/<workspace-id>/...
```

## Rules

- `WorkspaceRoot` and `LocalStateRoot` are runtime configuration, never stored as absolute paths inside portable records.
- All durable references are typed IDs plus relative logical locations. Moving the root requires no record rewrite.
- IDs are random UUID-derived tokens; display names, email, birth date, diagnosis, and subject goals do not appear in filenames.
- Canonical path segments are lowercase ASCII `[a-z0-9_-]`, bounded in length, and exclude Windows reserved names, trailing dots/spaces, separators, control characters, `.` and `..`.
- Resolve every path against the canonical root and reject traversal, unexpected symlinks/reparse points, and case-fold collisions before access.
- Content-addressed objects use lowercase SHA-256 and are immutable. Verify digest before read and after copy/sync.
- Durable JSON is UTF-8, canonical-key serialized, newline-terminated, schema-versioned, and size-bounded. Binary assets declare media type, size, and digest in a manifest.
- `raw-reserved` contains documentation only until #5 B-001 is resolved; an implementation must reject other files there by default.

## Ownership model

`shared/` means reusable within this workspace, not public or safe for every learner. A user-specific generated assistant stays under that user unless an authorized review promotes a privacy-free artifact to `shared/`. Progress and session records never move to `shared/`.
