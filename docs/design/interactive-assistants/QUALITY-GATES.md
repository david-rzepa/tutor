# Quality gates

Every assistant version must satisfy these gates before learner use.

## Pedagogy

- objective, prerequisite, mechanism, item/rubric, misconception, and evidence contracts agree;
- the learner performs the intended mental operation before reveal;
- feedback identifies an actionable gap and creates a meaningful retry;
- scaffolds can fade; immediate performance is not labeled durable mastery;
- generated tasks are grounded, answerable, level-appropriate, and free of answer leakage.

## Accessibility and age

- semantic controls, keyboard path, focus order, visible focus, screen-reader names/status, zoom/reflow, reduced motion, contrast, target size, and non-time-pressured alternative;
- equivalent routes preserve the construct where possible; limitations are explicit;
- instructions and correction match language/reading level without infantilizing older learners;
- microphone, audio, speech, drag, color, or fine-motor interaction is never the sole route unless it is the declared construct and an honest alternative is impossible.

Use the research [accessibility workflow](../../research/learning-design/AGE-ACCESSIBILITY-SAFETY.md#accessibility-is-capability-not-style) rather than diagnoses or fixed styles.

## Safety, privacy, and authority

- data is classified by purpose, provenance, retention/deletion rule, and authority;
- assistant receives only capability-scoped ephemeral data; no raw profile or stable identity;
- child-facing content, external links, social simulation, and open generation have reviewed bounds;
- pause/stop, correction, and appropriate guardian controls are visible;
- no real transcript or personally identifiable content enters public commits, logs, issues, or reports;
- external writes, deployment, real-data collection, and new safety/privacy behavior require their separate authority.

## Technical validation

- protocol/schema, sequencing, idempotency, timeouts, fallback, restart, and version compatibility tests;
- CSP/origin, network/device capability, payload/quota, injection, and secret/PII boundary tests;
- deterministic seeded run and trace replay;
- provenance digests for assistant, template, content, rubric, and model-generated artifacts;
- learner-visible graceful failure without exposing stack traces or hidden state.

## Release evidence

A release bundle contains manifest and digests, supported populations/objectives, automated results, accessibility statement, privacy classification, synthetic traces including failure/adaptation, known limitations, rollback/retirement path, and the responsible review authority.
