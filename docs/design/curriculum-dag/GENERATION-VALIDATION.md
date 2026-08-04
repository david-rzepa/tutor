# Generation, validation, and replanning

## Generate during onboarding

1. Establish user/guardian authority, privacy and accessibility settings before collecting evidence.
2. Capture subject goal, relevance, available time/context, starting confidence, constraints, and preferred meaningful contexts without assigning a fixed learning style.
3. Load approved subject sources/standards and age/access research appropriate to this learner.
4. Use a short, low-risk diagnostic or trusted prior evidence to place/waive foundations with uncertainty.
5. Backward-design capabilities and evidence from the goal, then add only justified prerequisite clauses.
6. Mark optional/enrichment branches and multiple valid routes; keep the first visible horizon small while retaining the complete validated graph.
7. Validate, explain major assumptions to the user/guardian, and publish an immutable version.

The graph generator may propose; deterministic validators and reviewed safety/privacy/authority rules decide whether it can publish.

## Validation gates

| Gate | Required check |
|---|---|
| schema/identity | unique stable IDs, known major, bounded fields, valid references and provenance |
| acyclicity | Kahn or DFS cycle check over blocking prerequisite edges; report exact cycle |
| reachability | every required goal node is reachable from a satisfiable foundation/placement route |
| requirement logic | every clause has at least one valid member; waiver authority/scope/expiry valid |
| coverage | goal outcomes and declared standards map to required nodes/evidence; no orphan required content |
| granularity | nodes are observable and teachable without being trivial clicks or multi-month black boxes |
| evidence | provisional, delayed retention, and transfer expectations are construct-valid and accessible |
| grounding | sources support content and prerequisite claims; uncertainty and evidence grade retained |
| fairness/access | no route depends on irrelevant modality, diagnosis inference, protected trait, or fixed style |
| safety/privacy | age/safeguarding limits, minimal data, isolation, authority, stop/correction paths |
| feasibility | at least one available assistant/human/off-screen activity can gather each required evidence type |

Cycle removal must reconsider the prerequisite claim; never break cycles arbitrarily by ID/order.

## Replanning triggers

- goal, available time, age/access setting, or authority changes;
- diagnostic/learning evidence contradicts placement or reveals a missing prerequisite/misconception;
- repeated assistant mismatch indicates wrong granularity or route;
- approved curriculum/source version changes;
- node/evidence contract becomes invalid, unsafe, inaccessible, or unsupported.

## Replanning contract

Create a child graph version with a machine-readable change set: add, supersede, archive, split, merge, change requirement, change route metadata, or change goal. Preserve old graph/evidence. Recompute readiness from compatible evidence; never convert evidence to a new semantic node without an explicit mapping and confidence. Show the learner/guardian material route changes and allow correction.

Graph evolution can branch concurrently under sync. Multiple heads reconcile only when edits are compatible; otherwise surface both proposed plans under the [workspace conflict model](../workspace-layout/SYNC-CONCURRENCY.md#conflict-model).
