# Evidence grading contract

Agents must distinguish a plausible mechanism from a dependable design rule. Evidence labels are local decision aids, not claims of universal certainty.

## Grades

| Grade | Minimum basis | Permitted use |
| --- | --- | --- |
| `strong` | Convergent systematic review/meta-analysis plus representative controlled evidence across relevant settings | Default behavior, while retaining stated moderators |
| `moderate` | Multiple credible studies or one strong synthesis with material population/context limits | Default within the supported population; measure outcomes |
| `emerging` | Promising controlled evidence, recent field evidence, or a strong mechanism without broad replication | Bounded experiment behind a flag; never a universal default |
| `contested` | Mixed results, weak construct validity, or credible contrary evidence | Do not operationalize as fact; preserve the uncertainty |
| `unsupported` | No adequate evidence for the claimed treatment interaction or outcome | Do not use for personalization |
| `policy` | Law, regulation, rights framework, or authoritative safety guidance rather than efficacy evidence | Treat as a constraint in its jurisdiction/scope; obtain legal review where required |

## Required claim record

Every consequential principle records:

- `claim`: the smallest defensible statement;
- `population/context`: who and what the evidence covers;
- `grade` and `basis`;
- `moderators/limits`: when the effect may change or fail;
- `design action`: what the tutor should do;
- `failure mode`: how misuse could harm learning;
- `signals`: delayed, observable measures that could falsify the design assumption;
- `sources`: stable source IDs from [SOURCES.md](SOURCES.md).

Do not copy an effect size across different outcomes, ages, subjects, controls, or follow-up intervals. “Statistically significant” does not mean educationally important. Prefer direct measures of unaided retention and transfer; label self-report, completion, and enjoyment as secondary evidence.
