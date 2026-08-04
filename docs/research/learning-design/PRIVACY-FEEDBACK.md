# Privacy-safe learning improvement loop

The system may turn learning evidence into GitHub issues only after data minimization, privacy review, and explicit external-write authority. This public repository must never become a learner record system.

## Data zones

| Zone | Examples | Rule |
| --- | --- | --- |
| Public design | general principles, synthetic scenarios, aggregate non-identifying findings | Repository allowed after review |
| Product operational | pseudonymous capability events and derived progress | Isolated authorized store; purpose/retention bound |
| Sensitive/restricted | minor identity, free-form conversation, disability/health details, voice/images, precise schedules/locations | Do not publish; collect only when essential and authorized |
| Secrets | credentials, access tokens, private endpoints | Never place in learner content, logs, prompts, or issues |

Pseudonymization is not anonymization. Small cohorts, rare conditions, timestamps, quotes, curriculum combinations, and longitudinal patterns can re-identify a learner.

## Issue-generation pipeline

1. Detect a product-level pattern tied to a design decision or failure mode.
2. Verify it across enough evidence for the claimed scope; retain uncertainty and counterexamples.
3. Remove direct identifiers, verbatim learner content, precise timestamps, unique combinations, and unnecessary demographic/condition detail.
4. Prefer synthetic reproduction. If aggregate statistics are needed, apply minimum-group and disclosure-risk rules defined by reviewed privacy design.
5. State the product behavior, expected behavior, population scope at a safe level, evidence grade, mastery/guardrail impact, and falsifiable acceptance signal.
6. Run automated secret/PII checks and authorized human/privacy review appropriate to risk.
7. Request/verify external-write authority, publish once, and store only a non-sensitive linkage locally.
8. Audit issue usefulness, false alarms, privacy incidents, and whether the fix improves unaided outcomes.

## Public issue shape

```text
Title: Improve <product behavior> under <non-identifying context>

Observed pattern: Aggregate or synthetic description; no learner content.
Why it matters: Mastery, flow, access, safety, or efficiency impact.
Evidence: Population scope, count/range where disclosure-safe, uncertainty, source versions.
Hypotheses: Multiple plausible product causes, clearly labeled.
Acceptance: Observable product and learning/guardrail signal.
Privacy review: Checks performed and safe disclosure rationale.
```

Never create an issue whose usefulness depends on exposing a learner's story. Keep restricted evidence in its authorized system and link only if repository visibility and reader authority are compatible.

## Child-specific governance

- verifiable guardian consent where required, plus age-appropriate child notice/assent;
- no commercial reuse, advertising, model training, or secondary purpose by default;
- collect only what the learning function needs;
- explicit retention schedule and deletion/export path;
- separate profiles and encryption/access controls;
- no open-web lookup containing personal learner facts;
- incident response and guardian/human escalation;
- jurisdiction-specific legal review before production.

Sources: [S013](SOURCES.md#s013), [S015](SOURCES.md#s015), [S016](SOURCES.md#s016), [S026](SOURCES.md#s026), [S027](SOURCES.md#s027).
