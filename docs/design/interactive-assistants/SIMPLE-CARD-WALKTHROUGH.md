# Synthetic walkthrough: small on-demand activity

This trace demonstrates the complete teaching loop with a card that can be built in milliseconds. It is deliberately domain-neutral: the same interaction mechanism can practice a science classification, a mathematical recall step, a musical ordering, or a language contrast.

## Frame

- Capability: make one target distinction and explain or reproduce it with decreasing support.
- Evidence need: distinguish supported success from an independent response; make no durable-mastery claim in-session.
- Assistant: a single-screen card with a prompt, two to four semantic controls, concise feedback, pause, and stop.
- Privacy: synthetic content and structured learning evidence only.
- Build budget: prefer reviewed configuration; permit a tiny generated local application when the interaction cannot fit a reviewed mechanism.

## Trace

1. The agent selects one curriculum capability and a small evidence gap. It generates either bounded configuration for a reviewed card or a tiny HTML/CSS/JS application.
2. The builder validates size, files, states, callbacks, semantic structure, protocol support, and prohibited capabilities. Invalid output becomes the same reviewed fallback card.
3. The host launches the result in the sandbox and sends `session.initialize`. The assistant returns `session.ready` with its build mode and configuration digest.
4. After repeated target errors, the assistant emits `adaptation.requested` with observations and a request for one easier scaffold. It does not infer a diagnosis or silently change the objective.
5. The agent applies the bounded scaffold. The next item supplies one cue; after a guided success, the assistant fades that cue.
6. A changed example checks the target again. The assistant reports attempts by scaffold, help use, misconception codes, adaptation history, and whether independent evidence exists.
7. The agent updates uncertain learner state and schedules later retention or transfer evidence. It may answer a learner question in chat, but returns teaching to an interactive activity when action and feedback are useful.

## Two build paths

| Path | Use when | On failure |
|---|---|---|
| reviewed template plus generated JSON | choice, sequence, or recall mechanics fit | reject invalid configuration and load the reviewed fallback |
| generated local application code | a small, materially different interaction is needed | reject unsafe or over-budget files and load the same fallback |

Generated application code is a supported first-class path, not an exception requiring a future platform. Configuration is the faster, more predictable path; it is not a restriction on the agent's ability to write code.

## Trace assertions

- The activity is small enough to construct on demand and contains no unnecessary world, characters, media, or navigation.
- Both paths use the same host, protocol, evidence contract, sandbox, stop controls, and deterministic fallback.
- Adaptation follows [FLOW-CONTROLLER.md](FLOW-CONTROLLER.md): repeated evidence, one scaffold change, then fade and changed-example confirmation.
- The result is compact evidence, not a raw transcript, engagement score, or mastery declaration.

## Population and access variations

A pre-reader version can use caregiver-mediated, large semantic controls and reviewed audio; an adult version can use denser text and learner-controlled pace. Keyboard, switch, text, caption, audio, or off-screen routes are selected according to the construct and access need rather than age stereotypes. If an alternative changes what is being measured, the system states that limitation instead of claiming equivalent evidence.

These variations follow the research [lifespan defaults and disability workflow](../../research/learning-design/AGE-ACCESSIBILITY-SAFETY.md).
