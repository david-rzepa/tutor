# Schema contract

## Curriculum

```json
{
  "schema": "tutor.curriculum/v1",
  "curriculum_id": "cur_018f-science",
  "user_id": "usr_018f-example",
  "subject": {"id": "science.general", "label": "General science"},
  "goal": {"statement": "Explain and predict simple systems", "target_horizon": "open"},
  "graph_version": "grf_0003",
  "status": "active",
  "generated_from": {
    "profile_head": "hed_profile_0042",
    "diagnostic_event_set": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "sources": ["source:approved-science-framework-v1"]
  },
  "created_at": "2026-08-04T00:00:00Z",
  "extensions": {}
}
```

`subject.id` is a stable taxonomy ID, not a filename inferred from the label. One profile can own many curriculum IDs, including multiple goals within one subject.

## Graph

```json
{
  "schema": "tutor.curriculum-graph/v1",
  "graph_id": "grf_0003",
  "curriculum_id": "cur_018f-science",
  "parents": ["grf_0002"],
  "nodes": [
    {
      "node_id": "cap_identify_parts",
      "kind": "capability",
      "label": "Identify relevant parts",
      "outcome": "Identify relevant parts in a simple system.",
      "requirements": [],
      "evidence_contract": {"provisional": ["varied_success"], "retained": ["delayed_success"], "transfer": ["novel_system"]},
      "misconception_ids": [],
      "activity_mechanisms": ["classification"],
      "importance": "required",
      "provenance": ["source:approved-science-framework-v1"],
      "accessible_routes": ["semantic-list", "physical-model"],
      "status": "active"
    },
    {
      "node_id": "cap_trace_relationships",
      "kind": "capability",
      "label": "Trace one relationship",
      "outcome": "Trace how two parts affect one another.",
      "requirements": [],
      "evidence_contract": {"provisional": ["varied_success"], "retained": ["delayed_success"], "transfer": ["novel_system"]},
      "misconception_ids": [],
      "activity_mechanisms": ["ordering", "causal-map"],
      "importance": "required",
      "provenance": ["source:approved-science-framework-v1"],
      "accessible_routes": ["text-diagram", "structured-list"],
      "status": "active"
    },
    {
      "node_id": "cap_predict_change",
      "kind": "capability",
      "label": "Predict how one change affects a simple system",
      "outcome": "Given a novel simple system, make and explain a prediction.",
      "requirements": [
        {"clause_id": "req_inputs", "any_of": ["cap_identify_parts", "waiver_prior_evidence"]},
        {"clause_id": "req_relationships", "any_of": ["cap_trace_relationships"]}
      ],
      "evidence_contract": {
        "provisional": ["two_varied_unaided_successes"],
        "retained": ["delayed_unaided_success"],
        "transfer": ["novel_context_explanation"]
      },
      "misconception_ids": ["linear_when_feedback_exists"],
      "activity_mechanisms": ["predict-observe-explain", "causal-map"],
      "importance": "required",
      "provenance": ["source:approved-science-framework-v1"],
      "accessible_routes": ["text-diagram", "structured-list", "physical-model"],
      "status": "active"
    }
  ],
  "waivers": [
    {
      "waiver_id": "waiver_prior_evidence",
      "clause_id": "req_inputs",
      "authority": "authorized-placement",
      "evidence_event_id": "evt_synthetic_001",
      "expires_at": "2026-09-01T00:00:00Z"
    }
  ],
  "created_at": "2026-08-04T00:00:00Z"
}
```

## Requirement semantics

All requirement clauses must be satisfied; any member within one clause may satisfy that clause. This AND-of-OR form represents required foundations with alternative/equivalent routes. A member is a node ID or an explicit waiver/placement record with provenance, authority, scope, and expiry/recheck rule.

Edges are derived from node references in requirements. They point prerequisite → dependent. Presentation may label an edge “recommended,” but a non-blocking recommendation is metadata, not a prerequisite edge.

## Evidence event link

Every observation references `user_id`, `curriculum_id`, `graph_id`, `node_id`, objective/item/rubric/assistant versions, scaffold/help state, observation, uncertainty, privacy/purpose, and provenance. A graph never embeds raw attempts or transcripts; it projects their authorized structured evidence.

## Stable identity and versioning

- Node IDs preserve meaning across graph versions. Materially changed outcomes/evidence contracts receive a new node ID and an explicit supersession relation.
- Labels, layout, accessible descriptions, and non-material metadata may change without changing semantic identity.
- Graphs are immutable and published under the [workspace head/object rules](../workspace-layout/MANIFESTS.md#versioned-head).
- Archived nodes remain resolvable while evidence references them.
