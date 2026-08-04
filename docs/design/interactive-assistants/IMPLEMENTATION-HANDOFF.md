# Implementation handoff

Implement the smallest vertical slice that proves the architecture before adding a large activity library.

## Milestone 1: contract and host

- shared envelope schemas and validators;
- trusted local host plus sandboxed browser adapter;
- capability negotiation, session IDs/sequencing/idempotency, timeout/fallback, pause/stop, checkpoints, and structured evidence sink;
- restrictive CSP/origin and zero ambient network/profile access;
- trace runner that replays deterministic synthetic sessions.

## Milestone 2: reusable teaching toolkit

- semantic accessible shell and controls;
- item/content/rubric slots with provenance;
- attempt, hint, feedback/retry, worked example/fading, adaptation request, and evidence-summary primitives;
- reviewed templates for at least two distinct mechanisms, recommended: classification/contrast and cued-to-unaided production;
- no points/streak machinery in the foundation.

## Milestone 3: two on-demand build paths

Implement the [small card trace](SIMPLE-CARD-WALKTHROUGH.md) through both first-class paths:

- generated bounded JSON for a reviewed template; and
- generated, validated HTML/CSS/JavaScript for an interaction that does not fit the template.

Keep both paths within explicit file, byte, state, item, callback, and build-time budgets. Route invalid or unsafe output to one deterministic reviewed fallback. Use at least two unrelated subject examples so no domain becomes an architectural assumption.

## Required tests

1. Contract/schema compatibility and invalid/oversized/duplicate message rejection.
2. Scripted fast path completes with no agent call.
3. Persistent error requests an easier scaffold; agent applies it; assistant fades after evidence.
4. Late or invalid agent output triggers deterministic fallback and remains replayable.
5. Restart does not duplicate evidence; stop/consent revocation prevents later work.
6. Unrelated subject examples reuse toolkit mechanics rather than copied implementations.
7. Keyboard and screen-reader-critical path, reflow, reduced motion, and non-audio route.
8. Sandbox cannot access undeclared network, device, filesystem, credentials, or learner profile.
9. Result contains structured evidence/provenance and no raw transcript or stable identity.

## Deferred boundaries

- Goal #5 defines feedback analysis, private transcript policy, consent lifecycle, and public issue generation; #4 only emits privacy-classified events.
- Production deployment, real learner accounts/data, jurisdictional compliance approval, and external hosting remain separate decisions.
- Additional activity types should be added only after evidence shows a missing mechanism, not to maximize catalogue size.

## Prioritized follow-on goals

1. **P1 — Local harness and reusable toolkit (#4):** implement the vertical slice and quality gates above.
2. **P1 — Consented efficacy loop (#5):** design with synthetic data; real transcript work remains blocked pending the explicit child/guardian data-lifecycle decision.
3. **P1 — Versioned curriculum/evidence schemas:** define capabilities, prerequisites, misconceptions, items/rubrics, privacy classes, retention/transfer evidence, and migrations used by the contract.
4. **P1 — Private learner model and onboarding:** implement isolated, inspectable, correctable state plus authority/accessibility setup; no public learner records.
5. **P2 — Activity validation pipeline:** automate content alignment, answerability, level, safety, bias, accessibility, leakage, and rubric checks before generation scales.
6. **P2 — Broaden mechanism library:** add activities only from observed curriculum/evidence needs and verify reuse plus delayed-learning benefit.

Each is independently capturable; dependencies should preserve the order: fixed contracts and privacy authority before real-data or broad generation work.

## Definition of done

The synthetic trace runs end to end locally and offline after asset load; reviewed configuration and generated application code share the host and protocol; unrelated subject examples stay inside the build budgets; invalid output falls back deterministically; all quality gates pass; artifacts are reproducible; and evidence can be interpreted without loading a transcript.
