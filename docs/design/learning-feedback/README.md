# Synthetic learning-feedback contract

This is the executable, synthetic-only portion of goal #5. It does not authorize real learner data, transcript collection, cross-user analysis, provider transfer, aggregate disclosure, or a public write. Those remain blocked by B-001 and the human decisions in [the safeguarding register](../safeguarding-privacy/DECISION-REGISTER.md).

## Context map

| Need | Contract |
|---|---|
| zones and allowed fields | [DATA-MODEL.md](DATA-MODEL.md) |
| purpose authority and learner controls | [CONTROLS.md](CONTROLS.md) |
| efficacy metrics, uncertainty, and disclosure | [ANALYSIS.md](ANALYSIS.md) |
| executable reference | [`src/learning-feedback`](../../../src/learning-feedback/README.md) |

The public repository is never a learner-record system. Issue generation ends at a deterministic local draft unless an accountable human confirms the exact payload digest and separately authorized writer.
