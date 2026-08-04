# Responsibility architecture

## Components

| Component | Owns | Must not own |
|---|---|---|
| Tutor agent | learner-goal interpretation; diagnosis; activity selection/configuration; generated content; non-routine feedback; adaptation decisions; post-session interpretation and scheduling | frame-by-frame UI, scoring deterministic items, hidden persuasion, unilateral safety/privacy decisions |
| Host/harness | launch, sandbox, capability negotiation, protocol validation, persistence boundary, timeouts/recovery, accessibility shell, event routing | teaching policy, inferred diagnosis, unconstrained content generation |
| Interactive assistant | focused UI, scripted mechanics, local validation/scoring, immediate known feedback, help controls, evidence emission, adaptation request | global learner model, raw profile access, arbitrary network/filesystem access, silently changing the learning objective |
| Curriculum/evidence services | approved capabilities, prerequisites, misconceptions, items/rubrics, provenance, mastery rules | presentation-specific behavior or engagement optimization |
| Private learner record | consented profile, evidence events, derived state, corrections/deletion | public issue content or assistant-readable identity |

The split makes the common path fast and testable while reserving agent calls for decisions that require context. It follows the research [teaching loop](../../research/learning-design/TUTOR-INTERACTION.md#teaching-loop) and [curriculum entities](../../research/learning-design/CURRICULUM.md#core-entities).

## Control loop

1. **Frame:** agent selects one capability, proximal goal, evidence need, allowed content, privacy class, and accessible alternatives.
2. **Select:** agent chooses a reviewed assistant/template whose mechanism matches the learning operation—not a presumed “learning style.”
3. **Configure:** host passes only the minimum activity configuration and ephemeral learner aliases.
4. **Run locally:** assistant handles ordinary input, scoring, feedback, retries, and UI state without agent latency.
5. **Escalate deliberately:** assistant requests agent help for a declared reason such as persistent misconception, content exhaustion, ambiguity, or requested explanation.
6. **Adapt one variable:** agent changes scaffold, representation, complexity, pace, or task type; objective changes require an explicit reframe.
7. **Return evidence:** assistant emits attempts plus a summary; the agent interprets rather than accepting a mastery claim at face value.
8. **Schedule:** agent chooses the next activity or delayed retrieval/transfer check and stores only authorized evidence.

## Decision authority

The assistant may make reversible, contract-bounded presentation changes. It may recommend an instructional change through `adaptation.requested`; the tutor agent approves or replaces that change. A safety stop, learner stop, consent withdrawal, or host policy always outranks pedagogical continuity.

Generated content is untrusted until it passes the activity’s schema, answerability, level, safety, accessibility, leakage, and rubric checks. If validation cannot establish a safe runnable state, use reviewed fallback content or stop; never improvise invisibly.

## Conversation fallback

Chat is appropriate when the learner asks a question, expresses a misconception that needs dialogue, needs emotional or metacognitive support within policy, or when no accessible assistant can serve the objective. The agent should then clarify briefly and, when useful, materialize the explanation into a tailored assistant that lets the learner act on the new understanding.

| Situation | Agent action | Interactive surface |
|---|---|---|
| learner asks a factual/procedural question | answer concisely with uncertainty/source bounds | offer a practice assistant only if action would consolidate it |
| response is ambiguous or misconception unclear | ask the minimum diagnostic question | then select/tailor an assistant against the clarified gap |
| known objective and reviewed pattern fit | configure and launch | existing assistant/template |
| pattern fits but examples/scaffold do not | generate bounded content in declared slots | validated tailored template |
| no pattern can express the required operation accessibly | teach/dialogue briefly or use an off-screen/human activity | do not force a website |
| safeguarding, consent, clinical, or other high-stakes boundary | stop and use reviewed human escalation | no autonomous generated assistant |
| repeated failure inside an activity | interpret evidence and change one dimension or prerequisite | assistant requests; agent decides; assistant applies |

## Invariants

- Assistants receive capability-scoped data, never an unrestricted profile or another learner’s data.
- Every adaptation has a reason and preserves an audit trail.
- Learner-visible goals, help, pause, stop, and correction controls remain available.
- Immediate performance never alone establishes mastery; use the [mastery evidence contract](../../research/learning-design/CURRICULUM.md#mastery-evidence-contract).
- Flow is a secondary, uncertain diagnostic and cannot weaken mastery, stopping, safety, or well-being.
