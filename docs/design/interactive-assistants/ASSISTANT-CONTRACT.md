# Assistant contract

The contract is a versioned message envelope between an untrusted local web assistant and a trusted host. Transport may be `postMessage`, a local process bridge, or a test adapter; semantics must remain identical.

## Envelope

```json
{
  "protocol": "tutor.assistant/v1",
  "session_id": "opaque-ephemeral-id",
  "sequence": 12,
  "message_id": "unique-id",
  "caused_by": "prior-message-id-or-null",
  "sent_at": "monotonic-or-ISO-time",
  "type": "attempt.recorded",
  "payload": {},
  "privacy": "ephemeral|learning_record|sensitive",
  "schema_version": 1
}
```

The host rejects unknown protocol majors, duplicate message IDs, invalid sequencing, oversized payloads, undeclared types, and data exceeding the session’s privacy/capability grant. Unknown minor capabilities are ignored only when explicitly marked optional.

## Lifecycle messages

| Direction | Type | Required purpose |
|---|---|---|
| host→assistant | `session.initialize` | objective, evidence contract, content bundle, allowed capabilities, locale, accessibility preferences, limits, privacy grant |
| assistant→host | `session.ready` | supported protocol/capabilities and validated configuration digest |
| either | `session.pause` / `session.resume` | learner or host-controlled interruption |
| assistant→host | `session.complete` | final evidence summary and learner-visible outcome |
| either | `session.stop` | explicit reason: learner, safety, consent, fatigue, host, unrecoverable error |
| either | `error.reported` | typed recoverable/fatal error without secrets or raw stack leakage to learner records |

Initialization includes no name, contact detail, diagnosis, date of birth, or raw transcript. Age band, input accommodation, or language preference is sent only when necessary to render this activity.

## Teaching messages

| Direction | Type | Core payload |
|---|---|---|
| assistant→host | `attempt.recorded` | item/skill IDs, response class or authorized response, correctness/rubric result, latency bucket, scaffold state, confidence, local sequence |
| assistant→host | `help.requested` | help kind, learner initiated, current scaffold, prior attempts |
| assistant→host | `adaptation.requested` | observed pattern, hypothesis, requested dimension and direction, bounds, urgency |
| host→assistant | `adaptation.applied` | accepted/replaced request, one changed dimension, rationale code, new bounded config |
| assistant→host | `agent.requested` | declared reason, compact state, allowed response schema, deadline, fallback |
| host→assistant | `agent.responded` | validated content/action, provenance, expiry, fallback status |
| assistant→host | `evidence.summarized` | observations, uncertainty, possible misconception, help/error/latency trajectory, completion/stop reason |

Deterministic scoring stays in the assistant. Free production may be classified locally by an approved rubric or sent through `agent.requested`; the original response is retained only when the activity’s reviewed evidence/privacy contract permits it.

## Adaptation dimensions

Allowed dimensions are `scaffold`, `complexity`, `representation`, `pace`, `choice_width`, `task_type`, and `content_variant`. An assistant requests rather than applies pedagogically material changes. The agent changes one dimension when practical and records:

```json
{
  "observed": {"consecutive_target_errors": 3, "help_use": "rising"},
  "hypothesis": "production demand exceeds current encoding",
  "dimension": "scaffold",
  "direction": "increase",
  "proposed": "recognition_then_cued_production",
  "preserves_objective": true
}
```

The agent must reject requests that merely prolong a session, suppress stopping cues, hide failure, reduce the declared evidence standard, or infer mood/disability from covert signals.

## Response and recovery rules

- Each `agent.requested` supplies a deterministic fallback. The UI never freezes while waiting.
- Deadline expiry invokes fallback and emits one recoverable error; late responses are discarded by message/session ID.
- Reconnection resumes only from a host-confirmed checkpoint; duplicated attempts are idempotent.
- Invalid generated content is rejected and replaced by reviewed content or a clean stop.
- Learner stop and privacy revocation take effect immediately; unsent sensitive payloads are discarded.

## Minimal evidence summary

```json
{
  "objective_id": "fr.a1.likes.ask-answer",
  "assistant_id": "choice-to-speech",
  "assistant_version": "1.0.0",
  "attempts": 8,
  "unaided_attempts": 3,
  "correct_by_scaffold": {"model": 2, "cued": 2, "none": 1},
  "misconception_codes": ["aimer_missing_subject"],
  "adaptations": ["scaffold:increase", "scaffold:fade"],
  "help_trajectory": "rising_then_falling",
  "latency_trajectory": "stable",
  "stop_reason": "goal_reached",
  "mastery_claim": "insufficient_delayed_evidence",
  "privacy": "learning_record"
}
```

This is evidence for agent interpretation, not permission to retain a transcript or declare durable mastery. Event design follows the research [event model](../../research/learning-design/PROGRESS-EVALUATION.md#event-model) and [privacy zones](../../research/learning-design/PRIVACY-FEEDBACK.md#data-zones).
