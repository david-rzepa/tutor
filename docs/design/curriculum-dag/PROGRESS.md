# Progress and evidence semantics

## Effective states

| State | Meaning | Typical transition evidence |
|---|---|---|
| `unseen` | no relevant authorized evidence | curriculum generation |
| `blocked` | prerequisite/safety/access requirement unsatisfied | derived, not a learner failure |
| `ready` | requirements satisfied; useful next work | readiness derivation |
| `learning` | attempts/scaffolds reveal active acquisition | recent meaningful work |
| `provisional` | current varied performance meets immediate contract | multiple valid attempts, including declared unaided evidence |
| `retained` | delayed retrieval meets horizon/contract | delayed unaided evidence |
| `transfer_verified` | outcome applied in a materially novel context | rubric-valid transfer evidence |
| `needs_review` | evidence is stale, contradictory, or prerequisite regressed | due date, new error, calibration change |
| `waived` | scoped placement/equivalence accepted, not “mastered” | authorized placement record |
| `archived` | node not active in current graph | graph evolution |

The highest label shown must not conceal uncertainty, help dependence, accessibility route, evidence age, or transfer limits. “Completed” is not a mastery state.

## Projection contract

For each node derive:

- state and confidence interval/category;
- evidence IDs and exact graph/node/item/rubric/assistant versions;
- last meaningful/unaided/delayed/transfer evidence;
- scaffold/help and misconception trajectory;
- next retention/transfer check and reason;
- contradictions, missing modalities only when construct-relevant, and calibration flags;
- privacy/purpose filters applied to the event set.

Projection algorithms are versioned and disposable. Given the same authorized event set, graph, and algorithm version, they must reproduce the same result.

## Aggregates

Curriculum progress reports required-node states weighted by goal relevance/evidence scope, never a single deceptive percentage. A compact summary may show:

- retained/transfer-verified required outcomes;
- provisional outcomes awaiting delayed evidence;
- ready choices and review-due items;
- estimated path remaining as a range with assumptions;
- learning-velocity trend using demonstrated mastery time plus retention/transfer guardrails.

Optional branches are reported separately. Waived nodes are not counted as learned. Graph-version changes explain denominator/path changes instead of showing apparent lost progress.

## Corrections and deletion

Users/guardians can challenge a state, source, placement, or goal. Correction appends an authorized event or graph revision; it does not rewrite raw history silently. Deleting authorized evidence rebuilds projections and may reduce readiness/progress. UI explains this before deletion without obstructing the right.

The model follows the research [mastery state machine and KPI](../../research/learning-design/PROGRESS-EVALUATION.md#mastery-state-machine).
