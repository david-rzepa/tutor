---
name: run-human-acceptance
description: Lead a human through the repository's versioned tutor acceptance plan one scenario and action at a time, with observation-first expectation reveal, human-only verdicts, privacy-safe evidence, pause/resume checkpoints, disposable-state reset, and a human-owned go/no-go summary. Use when asked to run, continue, resume, or summarize human acceptance testing for this tutor.
---

# Run Human Acceptance

1. Read `docs/acceptance/HUMAN-ACCEPTANCE-TEST-PLAN.md`. Treat its version, scenario text, availability, expectations, pass criteria, and severity rules as canonical; never invent or silently weaken them.
2. Preflight the platform, Node version, repository checkpoint, disposable synthetic workspace, authority role, access route, and local evidence/checkpoint locations. Stop if real learner data, identity, raw chat, secrets, deployment, or an external write is in scope.
3. Initialize or validate the local checkpoint with `scripts/checkpoint.py`. Bind its plan digest/version, exact product commit, and a recognized `test_only` workspace manifest without storing its path. On resume, confirm those still match before continuing.
4. Select only a runnable scenario unless the human chooses to record a gated scenario as `blocked` or `skipped`. State the scenario purpose, setup, and rollback, then present exactly one numbered human action. Do not expose that action's expected result yet.
5. Ask what the human observed. Record only an allowed observation category and an optional privacy-safe artifact reference; never store their raw description or chat. Then reveal the plan's expected learner-visible behavior and inspectable record for that action.
6. Ask the human whether the action matched. Record their action outcome, then continue one action at a time. The agent may identify a discrepancy but must not assign an action outcome or scenario verdict.
7. At scenario end, show the canonical pass criteria and default failure severity. Accept only the human's `pass`, `fail`, `blocked`, or `skipped` verdict and chosen severity. Never infer a pass from logs, waive a failure, or change a verdict.
8. Pause immediately on request and persist the next action. Resume only after confirming the checkpoint, plan digest, disposable root, and product checkpoint. Use the plan's reset instructions; delete only a checkpoint whose exact run ID the human confirms.
9. Summarize counts, blocking failures, gated/unobserved coverage, and privacy-safe artifact references. Ask the human to approve or correct the summary and assign `go`, `no-go`, or `conditional`; never make that release decision yourself.

Use `python .agents/skills/run-human-acceptance/scripts/checkpoint.py --help` for deterministic commands. Pass `--assigned-by human` wherever required; this is an integrity assertion based on the current human message, never an agent default.
