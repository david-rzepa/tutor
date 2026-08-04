# Progress, mastery, flow, and evaluation

Progress is an evidence history over explicit capabilities. It is not points, content completed, a global “smartness” score, or a model's unsupported impression.

## Event model

Store append-only evidence events and derive current summaries. A minimal event contains:

- pseudonymous learner and isolated profile namespace;
- curriculum, capability, activity/item, rubric, and evaluator versions;
- time bounds and context necessary to interpret the attempt;
- response/result with separate correctness dimensions where appropriate;
- independence and highest help level;
- confidence/calibration when useful and optional;
- error/misconception hypothesis with uncertainty;
- accessibility path used, without unnecessary diagnosis;
- privacy class, purpose, provenance, and retention/deletion rule.

Free-form conversations are high-risk and difficult to compare. Extract the smallest necessary evidence and discard/redact raw content according to policy.

## Derived learner state

For each capability, keep:

- current mastery estimate **and uncertainty**;
- evidence count and diversity of items/contexts;
- strongest independent performance;
- last practice and scheduled retention check;
- transfer and retention status;
- recurring misconception hypotheses;
- calibration and help trajectory;
- stale/out-of-distribution flags.

Knowledge tracing or item-response models may summarize evidence, but model output is not truth. Version and calibrate models, audit subgroup error, expose why a state changed, and allow correction. Do not deploy complex models before enough representative data exists; explicit rules with uncertainty are safer at cold start.

## Mastery state machine

`unseen → exposed → practicing → provisionally_mastered → retained → transferable`

Allow regression when later evidence contradicts the state. “Provisionally mastered” requires multiple suitable opportunities with limited help; “retained” requires a declared delay; “transferable” requires a changed context that still measures the same construct.

## Primary KPI: time to demonstrated mastery

Measure a cohort- and capability-specific duration or number of meaningful opportunities from a declared starting point to a fixed mastery criterion. Always report:

- mastery criterion and assessment version;
- active learning time separately from wall-clock delay needed for spacing;
- prior-knowledge baseline;
- retention/transfer follow-up;
- censoring, missingness, and sample size;
- distribution (not only mean), uncertainty, and relevant subgroup checks;
- support/human/AI resources used.

Never claim faster learning if the target, item difficulty, help, retention interval, or population changed without adjustment.

## Guardrail metrics

- delayed retention and transfer;
- false-mastery and overpractice rates;
- access failures and subgroup gaps;
- unsafe/hallucinated feedback rate;
- learner/guardian correction, export, and deletion outcomes;
- unwanted dependence or answer-reveal rate;
- well-being, frustration, and stopping behavior where collected appropriately.

Completion, clicks, streaks, raw session time, satisfaction, and self-reported flow are diagnostic—not success metrics.

## Flow measurement

Prefer low-intrusion operational signals (help/error/latency trajectory, interruption cost, voluntary stop/return) plus brief optional learner check-ins. Do not infer emotion from camera, voice, biometrics, or covert behavioral profiling. A child or guardian can disable flow personalization without losing core instruction.

Use flow to choose among educationally sound next actions. Never extend a session, weaken stopping cues, or lower mastery evidence merely to increase predicted flow.

## Evaluation ladder

1. **Content/unit checks:** answerability, alignment, accessibility, safety, and generation audit.
2. **Single-learner N-of-1 signals:** reversible adaptations with delayed within-learner comparison; no causal overclaim.
3. **Pilot:** feasibility, access, data quality, failure modes, and retention.
4. **Controlled comparison:** preregistered mastery and guardrail outcomes where practical; test unaided performance.
5. **Release monitoring:** calibration, drift, subgroup harms, deletion/consent behavior, and issue quality.

Use the smallest design capable of falsifying the decision. Qualitative evidence can explain mechanisms and failures; it does not replace mastery outcomes.

Sources: [S008](SOURCES.md#s008), [S016](SOURCES.md#s016), [S018](SOURCES.md#s018), [S019](SOURCES.md#s019), [S026](SOURCES.md#s026), [S031](SOURCES.md#s031).
