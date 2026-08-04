# Per-user curriculum DAGs

Each profile may own multiple independently versioned subject curricula. A curriculum is a revisable instructional hypothesis: a directed acyclic graph (DAG) of capabilities/topics whose prerequisite requirements determine what is ready next. It is generated from the learner’s goals and starting evidence, then updated without rewriting historical evidence.

The DAG is not the subject’s complete knowledge graph. Real concepts may reinforce one another cyclically; the DAG records only the current instructional ordering constraints needed for navigation and evidence planning.

## Decision kernel

1. Protect learner/guardian authority, privacy, accessibility, safety, and correctability.
2. Start from meaningful subject goals and observable evidence, not a catalogue or game mechanic.
3. Preserve multiple valid routes and uncertainty; add an edge only when its prerequisite claim is justified.
4. Derive readiness and progress from versioned evidence, including delayed retention and transfer.
5. Use visualization and celebration to clarify meaningful progress, never to coerce continuation or substitute completion for learning.
6. Replan visibly; never erase the path/evidence that produced the current state.

## Load map

| Need | Load |
|---|---|
| Exact curriculum/node/requirement schemas | [SCHEMA.md](SCHEMA.md) |
| Generate, validate, version, or replan a graph | [GENERATION-VALIDATION.md](GENERATION-VALIDATION.md) |
| Compute readiness and available routes | [READINESS.md](READINESS.md) |
| Interpret evidence and progress states | [PROGRESS.md](PROGRESS.md) |
| Design the graph/progress UI and gamification | [VISUALIZATION.md](VISUALIZATION.md) |
| Inspect cross-domain synthetic examples | [EXAMPLES.md](EXAMPLES.md) |
| Implement storage, services, and assistant integration | [IMPLEMENTATION-HANDOFF.md](IMPLEMENTATION-HANDOFF.md) |

## Related contracts

- Storage/version publication: [portable workspace layout](../workspace-layout/README.md).
- Activity selection/evidence exchange: [interactive assistants](../interactive-assistants/README.md).
- Learning evidence and KPI: [progress evaluation research](../../research/learning-design/PROGRESS-EVALUATION.md).
- Capability and mastery foundations: [curriculum research](../../research/learning-design/CURRICULUM.md).
