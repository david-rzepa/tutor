# Interactive teaching assistants

This design makes short-lived local web activities—the “interactive assistants”—the primary teaching surface. The tutor agent diagnoses, chooses and configures the activity, responds when bounded judgment is needed, and interprets returned evidence. It does not default to teaching through a long chat.

## Decision kernel

1. Protect learner safety, privacy, accessibility, agency, and stopping rights.
2. Choose a learning objective and the evidence that would change the learner model.
3. Prefer a focused interactive assistant when action, retrieval, discrimination, manipulation, simulation, or repeated feedback can teach more efficiently than conversation.
4. Keep deterministic interaction local; call the agent only for pedagogical judgment or content the activity cannot safely resolve.
5. Adapt challenge to restore productive work, but never treat flow, time-on-task, or completion as mastery.
6. Return compact evidence and uncertainty, then schedule retention or transfer evidence.

This order derives from the [research decision kernel](../../research/learning-design/DESIGN-HANDOFF.md#decision-kernel), [instructional principles](../../research/learning-design/PRINCIPLES.md), and [progress contract](../../research/learning-design/PROGRESS-EVALUATION.md).

## Load map

| Need | Load |
|---|---|
| Decide what the agent, host, and assistant own | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Implement or validate messages | [ASSISTANT-CONTRACT.md](ASSISTANT-CONTRACT.md) |
| Select an interaction pattern | [ACTIVITY-TAXONOMY.md](ACTIVITY-TAXONOMY.md) |
| Tune challenge and preserve healthy flow | [FLOW-CONTROLLER.md](FLOW-CONTROLLER.md) |
| Understand creation through retirement | [LIFECYCLE.md](LIFECYCLE.md) |
| Choose the first platform and security boundary | [PLATFORM-DECISION.md](PLATFORM-DECISION.md) |
| Persist profiles, curricula, modules, sessions, and evidence | [Portable workspace layout](../workspace-layout/README.md) |
| Apply safety, privacy, accessibility, or generation gates | [QUALITY-GATES.md](QUALITY-GATES.md) |
| Audit research traceability and uncertainty | [DESIGN-BASIS.md](DESIGN-BASIS.md) |
| Trace an age-11 French session end to end | [FRENCH-WALKTHROUGH.md](FRENCH-WALKTHROUGH.md) |
| Plan the implementation milestone | [IMPLEMENTATION-HANDOFF.md](IMPLEMENTATION-HANDOFF.md) |

## Scope boundary

This is a technology-neutral product and protocol design. Goal #4 owns implementation of the local host, reusable teaching toolkit, and example assistants. Goal #5 owns the consented feedback/effectiveness loop. The public repository is not a learner-record or transcript store.
