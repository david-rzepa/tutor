# Tutor implementation roadmap

This is the context-efficient traceability index from approved design to canonical ZzzOps goals. GitHub Issues own current status, criteria, and blockers; design modules own contracts and rationale. Load issue bodies only for the selected work.

## Coverage

| Design boundary | Canonical goal | Dependency / gate | Durable evidence |
|---|---:|---|---|
| learning science, lifespan/access, context strategy | [#1](https://github.com/david-rzepa/tutor/issues/1) done | none | `docs/research/learning-design/` |
| interactive-assistant architecture and flow | [#3](https://github.com/david-rzepa/tutor/issues/3) done | #1 | `interactive-assistants/` |
| protocol, toolkit, sandboxed host, tiny cross-domain builds | [#4](https://github.com/david-rzepa/tutor/issues/4) done via [#6](https://github.com/david-rzepa/tutor/issues/6), [#7](https://github.com/david-rzepa/tutor/issues/7), [#8](https://github.com/david-rzepa/tutor/issues/8) | #3, #9, #10 | packages, host, examples, E2E tests |
| portable workspace contract | [#9](https://github.com/david-rzepa/tutor/issues/9) done | research | `workspace-layout/` |
| curriculum DAG/progress contract | [#10](https://github.com/david-rzepa/tutor/issues/10) done | #1, #3, #9 | `curriculum-dag/` |
| consented feedback, effectiveness analysis, learning-velocity KPI | [#5](https://github.com/david-rzepa/tutor/issues/5) | B-001: reviewed consent/transcript lifecycle | `PRIVACY-FEEDBACK.md`, `PROGRESS-EVALUATION.md` |
| safeguarding, consent, authority, data lifecycle | [#14](https://github.com/david-rzepa/tutor/issues/14) | #1; human legal/deployment decisions remain gates | new design boundary |
| curriculum/evidence schemas and validation | [#12](https://github.com/david-rzepa/tutor/issues/12) | #10 | schema package + property tests |
| immutable multi-user workspace repository | [#13](https://github.com/david-rzepa/tutor/issues/13) | #7, #9 | repository + fault/isolation tests |
| deterministic evidence projection and readiness | [#15](https://github.com/david-rzepa/tutor/issues/15) | #12 | learning-state package + properties |
| migration, backup, restore, conflict/deletion lifecycle | [#16](https://github.com/david-rzepa/tutor/issues/16) | #13; destructive authority remains gated | fault-injected lifecycle tests |
| private profiles, onboarding, correction, authority UI | [#17](https://github.com/david-rzepa/tutor/issues/17) | #12, #13, #14 | synthetic multi-population flows + negative tests |
| per-user/per-subject curriculum generation and revision | [#18](https://github.com/david-rzepa/tutor/issues/18) | #12, #15, #17 | three-domain generation trace |
| accessible DAG/progress explorer | [#19](https://github.com/david-rzepa/tutor/issues/19) | #15, #18 | equivalent visual/non-visual interaction tests |
| tutor agent skill and orchestration policy | [#20](https://github.com/david-rzepa/tutor/issues/20) | #4, #15, #17, #18 | end-to-end synthetic teaching traces |
| pedagogical generated-activity validation | [#21](https://github.com/david-rzepa/tutor/issues/21) | #4, #12 | adversarial cross-domain validation fixtures |

Every design handoff is covered by one row. #5 owns evaluation/feedback/public-issue generation; #14 owns the prerequisite authority contract, avoiding a duplicate efficacy goal. #8 owns structural construction budgets; #21 adds pedagogical/content validation rather than rebuilding the sandbox.

## Execution topology

```text
#14 safeguarding ───────────────┐
                                ├─> #17 profiles ─> #18 curricula ─> #20 tutor skill
#12 schemas ─> #15 projection ──┘          │              └─────────> #19 explorer
      └────────────────────────────────────┘
      └─> #21 activity validation

#13 workspace ─> #16 lifecycle
      └─────────> #17 profiles

#14 reviewed decisions ─> resolve/narrow #5 B-001 ─> #5 efficacy loop
```

The durable-learning critical path is **#12/#14 → #17 → #18 → #20**, with #13 required before profiles persist. #12, #13, and #14 can begin in parallel. #21 can proceed after #12 independently of learner data. #16 and #19 are parallelizable after their prerequisites. #5 may continue synthetic design work but real transcript collection/retention remains forbidden until B-001 is resolved through #14 and explicit human authority.

## Portfolio invariants

- Domain-general contracts; subject examples are optional fixtures only.
- Synthetic data until reviewed authority permits more.
- One implementation goal per independently verifiable contract, trusted service, workflow/UI, or safety boundary.
- Assistants receive one curriculum slice and return structured evidence; never full profiles, paths, identity, or raw history.
- Learning speed means time to durable demonstrated mastery with retention/transfer and harm guardrails—not engagement, completion, or one-session success.
- External providers, deployment, destructive operations, encryption/key recovery, transcript retention, and public learner-derived writes require explicit reviewed authority.
