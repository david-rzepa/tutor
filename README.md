# Tutor

A local, domain-general tutoring framework that uses small interactive web assistants as the primary learning surface. It combines immutable curriculum DAGs, conservative learning-evidence projections, adaptive orchestration, private portable workspaces, and a human-owned acceptance workflow.

This repository is a runnable development baseline, not a released unified application. Onboarding/profile/curriculum services and the progress explorer currently need agent or command assistance. Real learner transcript collection, deployment analytics, and public learner-derived issue writes are disabled pending deployment-specific human authority.

## Quick start

Requirements: Node.js 22 or newer. Python 3 is additionally required for the human-acceptance checkpoint helper. The commands below were observed on Windows PowerShell; the automated fixtures are portable, but macOS/Linux have not received human acceptance.

Run all tests (no package install is currently required):

```powershell
npm test
```

Build the three synthetic assistant examples and start the loopback-only host:

```powershell
node examples/interactive-assistants/build.js config examples/interactive-assistants/configs/science-change.json
node examples/interactive-assistants/build.js config examples/interactive-assistants/configs/music-order.json
node examples/interactive-assistants/build.js app examples/interactive-assistants/sources/adult-math-app
node src/interactive-assistant-harness/server.js 41739
```

Open the printed `127.0.0.1` URL with `?card=science_change`, `?card=music_order`, or `?card=adult_math_recall`. These are small science, music, and mathematics fixtures—not a subject-specific architecture or a complete game.

## Human acceptance

Invoke [`$run-human-acceptance`](.agents/skills/run-human-acceptance/SKILL.md) in Codex for human-only evaluation of UX, aesthetics, comprehension, affordances, accessibility experience, and journey coherence. The facilitator runs technical checks itself, states expectations before each action, accepts feedback at any time, and turns approved actionable feedback into ZzzOps goals before the human-owned release decision.

The visual/non-visual curriculum explorer is now runnable with command assistance. Unified non-developer onboarding and real learner/public-feedback scenarios remain unavailable for the reasons recorded in the plan.

## Architecture map

- [Implementation roadmap](docs/design/ROADMAP.md): current component/goal traceability and authority gates.
- [Learning-design research](docs/research/learning-design/README.md): evidence basis and context-efficient design handoff.
- [Interactive-assistant design](docs/design/interactive-assistants/README.md) and [runnable examples](examples/interactive-assistants/README.md).
- [Curriculum DAG and progress design](docs/design/curriculum-dag/README.md) and [explorer implementation](src/curriculum-explorer/README.md).
- [Portable workspace design](docs/design/workspace-layout/README.md), [repository](src/workspace-repository/README.md), and [lifecycle operations](src/workspace-lifecycle/README.md).
- [Safeguarding and privacy](docs/design/safeguarding-privacy/README.md) and [feedback boundary](docs/design/learning-feedback/README.md).

## Safety and data boundary

Use opaque synthetic users and `test_only: true` disposable workspaces. Assistants receive a minimized activity slice—not identity, absolute paths, full profiles/history, credentials, or raw chat. Do not aim lifecycle deletion at this repository or any real workspace. External writes and real learner data require explicit reviewed authority that this local baseline does not grant.
