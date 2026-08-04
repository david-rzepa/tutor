# Project success charter

**Status:** complete
**Last reviewed:** 2026-08-04

## Overall goal
- Outcome: Deliver an agentic tutor skill that measurably accelerates learning while managing versioned curricula, interactive teaching assistants, learner progress records, and user profiles across multiple users.
- Primary beneficiaries: Learners using agent-based tutoring, Educators and curriculum maintainers, Repository maintainers improving the tutor from privacy-safe evidence
- Why it matters: Learners should reach demonstrated mastery faster, while maintainers receive actionable, privacy-safe evidence about what helped, what failed, and what should improve.
- Time horizon: Iterative: establish a baseline with the first usable learner cohort, evaluate at each curriculum milestone, and improve release over release.

## Success metrics
| KPI | Why it matters | Baseline | Target / threshold | Evidence source | Review cadence |
| --- | --- | --- | --- | --- | --- |
| time_to_demonstrated_mastery | Directly measures how quickly users are learning rather than proxy engagement. | Establish per curriculum and learner cohort during the first usable evaluation cycle. | Reduce median time or practice attempts to the same predeclared mastery threshold release over release. | Privacy-preserving progress records and comparable curriculum assessments. | At each curriculum milestone and summarized per release |

## Project acceptance criteria
- [x] The skill manages versioned curricula, interactive teaching-assistant workflows, progress records, and user profiles for multiple isolated users.
- [x] The tutor adapts instruction from a learner's demonstrated progress while preserving a consistent, observable mastery threshold.
- [x] Progress analysis identifies what went well, what did not, and actionable improvements.
- [x] The system can publish privacy-safe progress findings as GitHub issues under explicit external-write authority.
- [x] Evaluation compares learning speed without weakening mastery, privacy, or user isolation.

## Value rubric
- `critical`: required for project acceptance, safety, or a binding deadline.
- `high`: materially moves a priority KPI or unlocks critical/high-value work.
- `medium`: useful measurable contribution with limited leverage.
- `low`: weak, speculative, cosmetic, or currently unmeasured contribution.

When KPIs conflict, prefer: Privacy, user isolation, and demonstrated mastery take precedence over speed; among approaches meeting those guardrails, prefer faster learning.

## Constraints and non-goals
### Constraints
- Never expose personally identifying or sensitive learner data in GitHub issues or execution reports.
- Keep each user's profile and progress isolated, and require explicit authority for external writes and deployments.

### Non-goals
- No additional product non-goals have been declared yet.

### Unacceptable tradeoffs
- Faster apparent progress achieved by weakening mastery criteria, leaking learner data, or mixing records between users.

## Assumptions and open questions
- None recorded at initialization; add evidence-backed changes with history.

## Operating policy

- `[policy:backend]` **Canonical goal backend**: github_issues (customized from a ZzzOps default)
- `[policy:git_review_release]` **Git, review, and release**: Use main as the single implementation branch, with one Conventional Commit per verified sub-goal after required dependencies are integrated. Do not create per-goal branches or pull requests unless the user or repository explicitly requires one. (customized from a ZzzOps default)
- `[policy:execution_continuation]` **Execution and work continuation**: Continue across actionable goals under reviewed dependency and resource policy, and incorporate newly captured goals at the next safe checkpoint. (adopted from the recorded ZzzOps default)
- `[policy:verification_testing]` **Verification and testing**: Require artifact-appropriate observable evidence in small chunks; documentation and test cases need no recursive tests, while product behavior and reusable test infrastructure require direct verification. (adopted from the recorded ZzzOps default)
- `[policy:code_quality]` **Code-quality and refactoring boundaries**: Preserve behavior unless a goal explicitly authorizes a behavior change. (adopted from the recorded ZzzOps default)
- `[policy:dependencies_tooling]` **Dependencies, tooling, and generated artifacts**: Use project-native tooling; do not hand-edit generated or dependency-owned files. (adopted from the recorded ZzzOps default)
- `[policy:security_privacy_compliance]` **Security, privacy, secrets, and compliance**: Repository policy may tighten but never weaken ZzzOps safety and authority boundaries. (customized from a ZzzOps default)
- `[policy:documentation_style]` **Documentation and style**: Follow evidenced repository documentation, style, and user-communication conventions. (adopted from the recorded ZzzOps default)
- `[policy:deployment_resources]` **Deployment, environment, and resources**: Do not deploy without authority; choose bounded parallelism from the deterministic tracked-file repository size. (adopted from the recorded ZzzOps default)
- `[policy:automated_design]` **Automated design authority**: enabled (adopted from the recorded ZzzOps default)
- `[policy:autonomy_approval_parallelism]` **Autonomy, approvals, and parallelism**: Interview adaptively during goal capture; execute unattended by persisting consequential questions as durable blockers; refill valuable bounded work; use up to three worktree workers below 100 MB and read-only workers otherwise. (adopted from the recorded ZzzOps default)

Detailed rationale and review history: [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Canonical policy state: [POLICY.json](POLICY.json).
