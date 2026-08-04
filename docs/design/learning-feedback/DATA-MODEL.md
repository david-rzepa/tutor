# Data model and zones

| Zone | Contents | Public issue access |
|---|---|---|
| identity/authority | opaque subject/controller references and versioned purpose grants | none |
| raw reserved | transcript, free-form conversation, contact/identity, secrets | prohibited by B-001; no writer |
| structured private | enumerated observation, mechanism/component, bounded measurements, versions, synthetic provenance | none |
| aggregate finding | minimum-cohort metrics, guardrails, uncertainty, version provenance, private finding digest | renderer only |
| public draft | allowlisted title/body/labels and synthetic reproduction | exact-payload confirmation only |

`tutor.learning-feedback/v1` binds an immutable record ID, opaque subject reference, purpose, teaching mechanism/component, enumerated outcome and learner signal, bounded opportunity/time/hint/challenge/delay measurements, assistant/template/rubric/measurement versions, and synthetic dataset provenance. It has no free-text response field.

Public payloads contain no source rows, counts below the reviewed threshold, direct or indirect identifiers, quotes, contact patterns, secrets, or stable subject references. A finding digest supports a non-sensitive private audit link without revealing its sources.
