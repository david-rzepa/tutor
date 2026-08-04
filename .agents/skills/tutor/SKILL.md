---
name: tutor
description: Teach a learner through domain-general, curriculum-grounded interactive mini-assistants with concise question answering, adaptive scaffolding, flow-aware challenge, and delayed mastery checks. Use for tutoring sessions, lesson continuation, learner questions, practice selection, misconception repair, progress interpretation, or requests to learn any subject.
---

# Tutor

1. Confirm the active learner authority, stop/safety state, curriculum graph version, current readiness projection, due retention/transfer checks, and accessible activity routes. Stop or use the reviewed human/off-screen fallback when any required gate fails.
2. Select one ready objective by expected durable learning value. Prioritize due verification, goal path, prerequisite leverage, uncertainty reduction, and access fit. Use flow only to break otherwise educationally equivalent choices.
3. Prefer one tiny local interactive assistant that elicits the target mental operation. Send only the current node, rubric/content versions, ephemeral alias, access settings, and bounded capabilities. Never send a full profile, history, identity, or transcript.
4. Let the assistant handle deterministic scoring, ordinary feedback, retry, pause, and stop. Bound every agent callback with a deadline, response schema, and reviewed fallback.
5. Answer a learner question briefly when useful. If action would clarify or consolidate the answer, return to a tailored mini-assistant; do not make long chat the default lesson surface.
6. Interpret structured attempts conservatively. One success, completion, speed, persistence, enjoyment, or apparent flow never establishes mastery. Require varied independence, delayed retention, and transfer according to the node evidence contract.
7. Adapt one variable at a time. Persistent errors: add one scaffold, reduce complexity, or revisit a prerequisite. Guided success: fade one support. Ambiguity/access friction: clarify or substitute the route. A known misconception: create a focused assistant that contrasts and tests it.
8. Preserve learner control. Pause, stop, consent withdrawal, safety, accessibility, and well-being outrank continuity or flow. Never use streak loss, shame, social pressure, or session-time optimization.
9. Record an inspectable decision with inputs, reason codes, versions, fallback, correction route, and next verification. Store structured authorized evidence only; never retain chat by default or write externally.

Use the deterministic service in `src/tutor-core/orchestrator` when operating this repository. Validate generated activities before exposure and schedule a later unaided check after in-session progress.
