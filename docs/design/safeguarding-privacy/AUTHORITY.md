# Authority and consent contract

## Versioned record

An authority record is append-only and binds `authority_version`, opaque learner/user namespace, actor/role, verified relationship method, purpose, allowed capabilities, allowed data classes, notice version/access route, assent state when applicable, jurisdiction/deployment policy version, effective/expiry times, and superseded/revoked record. Identity proof stays in its separately authorized zone; assistants see only a capability decision.

## States

```text
unknown -> notice_presented -> pending -> active
   |             |             |          |
   +----------> denied <--------+          +-> suspended -> active
                                             |       |
                                             +-> revoked
                                             +-> expired
```

| State | Allowed behavior |
|---|---|
| `unknown` | public/synthetic material only; no learner record collection |
| `notice_presented` | accessible explanation and local choice UI only |
| `pending` | no affected collection; a verified decision is outstanding |
| `active` | only listed purpose/capability/data class until expiry |
| `suspended` | stop new affected processing; preserve minimal protected audit and rights workflows |
| `denied` / `revoked` / `expired` | no new affected processing; execute reviewed retention/deletion/export obligations |

Transitions are events with actor, reason code, producing policy version, and timestamp. Re-consent creates a new version; it never edits history or silently broadens an earlier grant.

## Roles and relationships

| Actor | Default authority |
|---|---|
| independent adult learner | self-authorize declared low-risk purposes after accessible notice |
| minor learner | activity assent/stop voice appropriate to development; cannot supply any legally required guardian authority |
| verified guardian | capabilities approved by reviewed policy; role conflicts or changes suspend affected processing |
| educator/caregiver | only delegated learning capabilities; no identity, export, deletion, transcript, or external-write authority by job title alone |
| local workspace administrator | storage operations within explicit scope; cannot reinterpret learning evidence or consent to secondary use |
| tutor agent / assistant module | ephemeral session capabilities only; no authority delegation or ambient profile access |
| maintainer/researcher | synthetic/public design by default; restricted aggregate access requires a separately approved purpose |

The verification method, age of independent consent, guardian rights, educator delegation, and conflicting-guardian process are deployment decisions, not constants in code.

## Capability decision

Every authorization check answers all fields:

```json
{
  "decision": "allow | deny | suspend",
  "authority_version": "opaque-version",
  "purpose": "learning_activity",
  "capability": "append_structured_evidence",
  "data_class": "learning_record",
  "expires_at": "timestamp",
  "reason_codes": ["active_grant", "minimum_scope"],
  "notice_access_route": "plain_text_screen_reader",
  "audit_event_id": "opaque-event"
}
```

Default deny if any binding is missing, stale, ambiguous, inaccessible, conflicting, or wider than the current task. A safety stop may override an allow; it does not grant a new use.

## Learner-facing explanation

Every access route must convey, without dark patterns: what the system wants to do; what minimum information it uses; who can see it; whether an AI/provider receives it; how long it is kept; how to say no/stop/correct/export/delete; what core learning remains available; and when an authorized human may be involved. Provide semantic text plus suitable spoken/printable/caregiver-mediated equivalents. Never demand a diagnosis to obtain an accommodation.
