# Readiness and route selection

Readiness is derived, not stored as truth. It depends on one graph version, evidence projection, waivers/placement, safety/access constraints, and current learner goal.

## Clause satisfaction

A prerequisite node satisfies a clause when its effective state meets that clause’s declared threshold, normally `retained`; a curriculum may explicitly allow `provisional` for low-risk practice while scheduling verification. A valid waiver/placement member satisfies only its scoped clause until its expiry/recheck.

```text
clause_satisfied(clause) = any(member_satisfies(m) for m in clause.any_of)
node_ready(node) = node.active
                   and all(clause_satisfied(c) for c in node.requirements)
                   and not node_effectively_mastered(node)
                   and safety_access_constraints_allow(node)
```

Root nodes with no requirements are ready unless already mastered/waived/archived or blocked by an explicit safety/access condition. A node can return from mastered-looking progress to `needs_review` when evidence expires, contradicts, or reveals prerequisite regression.

## Deterministic algorithm

1. Validate graph and compute stable topological order using `node_id` only as a tie-breaker.
2. Project authorized evidence into each node’s effective progress state and uncertainty.
3. Evaluate requirement clauses in topological order.
4. Produce sets: `blocked`, `ready`, `learning`, `review_due`, `goal_reached`, plus human-readable reasons.
5. Among `ready`/`review_due`, rank by goal-path relevance, prerequisite leverage, retention due date, evidence uncertainty, learner constraint/access fit, and expected learning value.
6. Offer bounded meaningful choice among educationally sound alternatives; flow can break ties but cannot bypass prerequisites/evidence/safety.

Ranking is advisory and inspectable. It must report why a node is available/blocked and what evidence would change that state.

## Multiple routes and cross-subject capabilities

Alternative routes appear in `any_of` clauses or optional branches. The UI may recommend one but lets the learner inspect alternatives. A capability reused across subjects has separate curriculum-local nodes or an explicit shared-capability reference. Evidence does not silently leak across curricula/users: importing evidence requires semantic-version compatibility, provenance, authorization, and an uncertainty mapping recorded in both projections.

## Failure behavior

- No ready node before goal reached: graph invalid or evidence/waiver missing; diagnose, do not unlock everything.
- Too many ready nodes: narrow by goal leverage and learner constraints; preserve an “explore more” route.
- Prerequisite oscillation: show `needs_review`, schedule efficient recheck, and avoid erasing downstream evidence.
- Activity unavailable/inaccessible: choose another mechanism/off-screen/human route; do not mark the node pedagogically blocked if its construct can be assessed another way.
