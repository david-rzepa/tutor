# Assistant lifecycle

## 1. Specify

Declare capability, learner population/bounds, prerequisite assumptions, proximal goal, mechanism, evidence contract, misconception codes, accessibility routes, privacy class, and stop conditions. State what would falsify the assistant’s usefulness.

## 2. Select or generate

Prefer a reviewed template plus approved curriculum content. Generate a new assistant only when configuration cannot serve the objective. Reuse mechanics; tailor examples, representations, scaffolds, and content within declared slots.

## 3. Validate

Before learner exposure, validate schemas and protocol, curriculum alignment, answerability, scoring/rubric consistency, factual/source grounding, age and language level, answer leakage, bias, safety, accessibility, privacy, fallback behavior, and content-security restrictions. Open production requires a bounded rubric and uncertainty path.

## 4. Sandbox and launch

The host grants the minimum capabilities for one ephemeral session, verifies immutable assistant/content digests, establishes timeouts and reviewed fallback content, and passes only activity-relevant learner settings. No arbitrary network, filesystem, clipboard, camera, or microphone access.

## 5. Run and adapt

Scripted interaction handles the normal path. Agent calls use declared schemas and deadlines. Adaptations preserve the objective unless the agent explicitly reframes it. Learner pause/stop and host safety/privacy controls are always available.

## 6. Record and interpret

Emit idempotent attempt events and a compact evidence summary. Separate observation from inference; the agent updates the learner model with uncertainty and schedules delayed evidence. Discard ephemeral UI and disallowed response content at session end.

## 7. Evaluate and retire

Version templates, content, rubrics, and protocol independently. Compare learning speed, delayed retention, transfer, help dependence, access/safety harms, and failure rates. Retire or roll back versions that harm outcomes, leak data, become incompatible, or lack reproducible provenance. Existing evidence retains the producing version.

## Failure recovery

| Failure | Required behavior |
|---|---|
| agent unavailable/late | deterministic fallback; no frozen UI; mark provenance |
| invalid generated content | reject; reviewed fallback or clean stop |
| assistant crash/reload | resume host-confirmed checkpoint without duplicate evidence |
| protocol mismatch | refuse launch with actionable host diagnostic |
| evidence persistence unavailable | continue only if allowed; disclose and queue locally or stop |
| consent/access revoked | stop affected processing, discard unsent sensitive data, follow deletion policy |
| learner distress or safety signal | stop/escalate under reviewed safeguarding policy; do not improvise counseling |

The lifecycle applies the research [generative-AI boundary](../../research/learning-design/TUTOR-INTERACTION.md#generative-ai-boundaries) and [design review rubric](../../research/learning-design/DESIGN-HANDOFF.md#design-review-rubric).
