# Manifest contracts

Every schema uses an explicit major version and rejects unknown incompatible majors. Extension fields belong under `extensions` with a namespaced key.

## Root manifest

```json
{
  "schema": "tutor.workspace/v1",
  "workspace_id": "wrk_018f-example",
  "created_at": "2026-08-04T00:00:00Z",
  "format_version": 1,
  "features": ["immutable-progress-events", "versioned-profile-heads"],
  "privacy_policy_ref": "policy/default-v1",
  "registry": {
    "users": "registry/users.json",
    "modules": "registry/modules.json"
  },
  "extensions": {}
}
```

It contains no machine path, provider account, user display name, or secret. A machine-local workspace link records the current resolved path and provider hints without becoming portable truth.

## User registry entry

```json
{
  "user_id": "usr_018f-example",
  "profile_heads": "users/usr_018f-example/profile/heads",
  "curricula": ["cur_018f-science", "cur_018f-music"],
  "status": "active",
  "created_at": "2026-08-04T00:00:00Z"
}
```

The registry is an index, not the private profile. Removing an entry does not itself delete data; deletion follows the lifecycle transaction.

## Versioned head

```json
{
  "schema": "tutor.head/v1",
  "head_id": "hed_deviceA_018f",
  "record_type": "profile",
  "object": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "parents": ["hed_prior_018e"],
  "device_id": "dev_ephemeral-A",
  "logical_time": 42,
  "written_at": "2026-08-04T00:01:00Z"
}
```

Heads are append-only. One descendant of all prior heads is current. Multiple non-ancestor heads are an explicit conflict; the application never silently applies timestamp last-writer-wins.

## Module manifest

```json
{
  "schema": "tutor.module/v1",
  "module_id": "classification-grid",
  "version": "1.2.0",
  "kind": "assistant-template",
  "entry": "assets/index.html",
  "protocol": "tutor.assistant/v1",
  "capabilities": ["attempt.recorded", "adaptation.requested"],
  "files": [{"path": "assets/index.html", "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "bytes": 2048}],
  "review": {"status": "approved", "policy": "local-default-v1"},
  "provenance": {"source": "workspace", "generated": false}
}
```

The host verifies every listed path/digest and rejects unlisted files, unsafe paths, incompatible protocols, excessive size, and missing review authority. Manifests never grant ambient network, device, profile, or filesystem access.

## Progress event identity

An immutable event ID combines a random UUID with its producing device/session ID. Events include curriculum/node/item/template/rubric versions, observation, privacy class, purpose, and provenance. They do not rely on a single global counter, so concurrent offline devices cannot overwrite one another. Projections are disposable and identify the exact event-set digest used.
