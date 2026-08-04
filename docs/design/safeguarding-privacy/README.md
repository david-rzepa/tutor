# Safeguarding, consent, and learner-data authority

This architecture is a product-safety contract, not legal advice or permission to process real learner data. Until the [human decisions](DECISION-REGISTER.md) are approved for an actual deployment, the system may use only synthetic fixtures and privacy-minimized structured records in local development.

## Decision kernel

```text
verified actor + learner relationship + purpose + data class + current authority
  + accessible notice/assent + jurisdiction/deployment decisions
  -> minimum allowed capability and retention
  -> deny on ambiguity, expiry, revocation, role conflict, or provider mismatch
```

Authority is purpose- and capability-specific. Possessing a file, device, profile ID, guardian role, or prior consent never grants every action. Safeguarding can stop processing; it cannot improvise counseling, investigations, legal conclusions, or emergency services.

## Load map

| Need | Load |
|---|---|
| Decide who may do what and how authority changes | [AUTHORITY.md](AUTHORITY.md) |
| Classify, collect, retain, export, correct, revoke, or delete data | [DATA-LIFECYCLE.md](DATA-LIFECYCLE.md) |
| Review abuse cases, controls, incidents, and negative scenarios | [THREAT-MODEL.md](THREAT-MODEL.md) |
| See choices no agent may infer | [DECISION-REGISTER.md](DECISION-REGISTER.md) |

## Invariants

- One user namespace cannot read, infer, link, or write another user's records without explicit reviewed transfer authority.
- Learner notice is understandable and accessible; guardian authority never erases the learner's voice or right to stop an activity.
- Collect the minimum structured evidence for a declared purpose. Raw conversation, voice, images, precise location/schedule, diagnosis, and identity are restricted—not convenient telemetry.
- Revocation stops new affected processing immediately. Export/correction/deletion remain available under reviewed identity and legal-hold rules.
- Assistants receive opaque IDs and one activity slice, never identity, authority records, filesystem paths, full profiles, or raw histories.
- No advertising, commercial profiling, model training, public sharing, persuasive retention, or secondary use by default.
- Public repositories contain general design, synthetic reproduction, or reviewed disclosure-safe aggregates only; never learner stories or quotations.

Research basis: [privacy-safe improvement](../../research/learning-design/PRIVACY-FEEDBACK.md), [lifespan/accessibility/safety](../../research/learning-design/AGE-ACCESSIBILITY-SAFETY.md), and [workspace data zones](../workspace-layout/DATA-ZONES.md).
