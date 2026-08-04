# Repository agent rules

These instructions apply to the entire repository.

## Keep human acceptance current

Treat `docs/acceptance/HUMAN-ACCEPTANCE-TEST-PLAN.md` as the canonical product acceptance specification. Treat `.agents/skills/run-human-acceptance/SKILL.md` as its facilitator, not a second source of criteria.

Before completing any change, explicitly review its acceptance impact. This is required when a change affects:

- learner-, caregiver-, tester-, or operator-visible behavior;
- feature availability, setup, reset, recovery, platform support, or documented commands;
- curriculum, progress, tutoring, interactive-assistant, accessibility, or learner-control behavior;
- authority, privacy, isolation, retention, external-write, or safeguarding boundaries;
- the completion, blocking, replacement, or removal of a capability referenced by the plan.

For an affected change, update the plan in the same change. Add or revise all applicable scenario availability, setup, human actions, delayed expected results, inspectable records, pass/fail criteria, privacy-safe evidence, reset/rollback, and default severity. A completed dependency does not make a scenario runnable unless a tester-accessible surface and repeatable procedure actually exist.

Do not weaken, delete, reinterpret, or mark acceptance criteria satisfied merely to match an implementation or make tests pass. When behavior cannot meet a criterion, preserve the criterion and record the scenario as failed, blocked, unavailable, or explicitly out of scope. Agents never assign human verdicts, waive failures, or make the final go/no-go decision.

## Version and traceability

When acceptance meaning changes, increment the plan version and update every version reference in the plan and facilitator workflow:

- major: incompatible acceptance/checkpoint contract or decision model;
- minor: added/removed scenarios, changed availability, actions, expectations, pass criteria, severity, or safety/privacy boundaries;
- patch: material clarification that changes how an existing criterion is executed but not what is accepted.

Pure spelling, formatting, and link repairs need no version increment. Never change plan content without checking whether an active or resumable checkpoint will be invalidated; digest/version invalidation must fail closed and be explained in the handoff.

Keep the root `README.md`, implementation roadmap, canonical ZzzOps goal state, and acceptance-plan availability consistent. For source-changing ZzzOps work, record the acceptance-plan impact in self-review/completion evidence even when the conclusion is "reviewed; no acceptance change required."

## Completion checklist

Before declaring work complete:

1. Compare the diff and completed/blocked goals with the plan's availability table, scenario index, scenario cards, release-readiness limitations, and version references.
2. Update the plan and root documentation where required, or state why observable acceptance behavior is unchanged.
3. Check for stale goal numbers, gates, versions, commands, links, and platform claims with focused searches.
4. Run the smallest direct acceptance-related probe plus the relevant wider test suite. Changes to the acceptance facilitator or checkpoint helper must run `test/human-acceptance/checkpoint.test.js` and skill validation.
5. Report what acceptance coverage changed, what was directly observed, and what remains unobserved or authority-gated.

Documentation alone cannot certify product behavior. Automated tests and agent inspection cannot replace the human verdicts required by the acceptance plan.
