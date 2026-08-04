# Implementation handoff

## Prioritized goals

1. **Schema and validator:** curriculum/graph/node/requirements/waiver/change-set schemas; ID/version/provenance checks; cycle, reachability, clause, granularity, evidence, and accessibility validation.
2. **Evidence projection/readiness engine:** deterministic state projection, AND-of-OR requirements, placement/expiry, topological readiness, inspectable ranking, review-due and contradiction behavior.
3. **Workspace repository:** publish immutable graph versions/events/projections under [workspace paths](../workspace-layout/TREE.md); conflict, migration, archive/export/delete.
4. **Onboarding generator:** approved-source grounded goal decomposition, bounded diagnostic placement, validation, explanation, correction, and safe fallback templates.
5. **Accessible graph UI:** map plus outline/table/non-screen summaries, progressive disclosure, progress history, uncertainty, route choice, and gamification guardrails.
6. **Assistant integration:** select tiny on-demand activity templates by node objective/mechanism/evidence need; ingest compact versioned evidence; no subject logic in the harness.

## Assistant request slice

The tutor sends an assistant only the current node slice:

```json
{
  "curriculum_id": "cur_018f-science",
  "graph_id": "grf_0003",
  "node_id": "cap_predict_change",
  "objective": "Make and explain one prediction",
  "mechanism": "predict-observe-explain",
  "evidence_need": "provisional-varied-unaided",
  "allowed_scaffolds": ["worked", "guided", "cued", "none"],
  "content_refs": ["content:synthetic-system-v1"],
  "privacy": "learning_record"
}
```

It does not send the full graph/profile, filesystem path, identity, or raw history. Returned events bind every producing version and are interpreted by the projection engine, not by the assistant declaring mastery.

## Required property/fault tests

- arbitrary valid generated DAGs always topologically sort; cycle reports identify a real cycle;
- AND-of-OR readiness is order-independent and explanations name unsatisfied clauses;
- adding unrelated optional nodes cannot reduce existing progress;
- event arrival order cannot change a projection; deleting an event rebuilds correctly;
- graph split/merge/supersession never silently transfers mastery;
- multiple curricula/users cannot cross-read or auto-import evidence;
- every visual operation has keyboard/screen-reader/table equivalent;
- celebration cannot start sessions, hide stop, reward clicks/time, or relabel provisional evidence;
- invalid/unsafe/inaccessible generation fails to reviewed templates or human/off-screen planning.

## Success signal

Using synthetic profiles across at least three domains, the system generates valid distinct curricula, explains available/blocked routes, launches a tiny generic assistant for one node, incorporates structured evidence, schedules delayed verification, survives a graph revision, and renders equivalent visual and non-visual progress without exposing private raw records.
