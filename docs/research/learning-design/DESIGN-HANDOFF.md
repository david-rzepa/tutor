# Design handoff

These are proposed design-document goals, not implementation issues yet. Preserve their boundaries when converting them to canonical goals.

## Decision kernel

Every teaching decision should be explainable as:

```text
learner authority/access/context
  + versioned capability graph
  + recent evidence with uncertainty
  + due retention/transfer obligations
  + safety/privacy constraints
  → candidate educationally valid actions
  → choose for expected learning information/value
  → break ties with healthy flow and learner agency
  → observe, update, schedule, and permit correction
```

## Proposed initial goals

### 1. Define privacy and safeguarding architecture

Specify profile isolation, consent/guardian authority, age-appropriate notice, data classes, encryption/access, retention/deletion/export, redaction, incident/escalation, external AI/provider constraints, and public-issue disclosure review. Validate with threat models and synthetic child scenarios before collecting learner data.

### 2. Define versioned curriculum and evidence schemas

Specify capabilities, prerequisites, misconceptions, activities/items, rubrics, source provenance, accessibility alternatives, evidence events, retention/transfer requirements, and migrations. Include high-fidelity examples and schema validation.

### 3. Define inspectable learner model

Specify onboarding, cold start, uncertainty, evidence updates/decay, learner/guardian correction, mastery state machine, separation of access from knowledge errors, and simple-model-first calibration. Do not start with deep knowledge tracing.

### 4. Define tutor policy and flow controller

Specify the teaching loop, assistance ladder, feedback selection, challenge/scaffold adjustments, stopping/recovery, LLM grounding/validation, safety escalation, and telemetry. Flow remains below mastery and well-being.

### 5. Define evaluation and privacy-safe improvement loop

Operationalize time to demonstrated mastery, retention, transfer, false mastery, overpractice, subgroup/access harms, flow diagnostics, hallucination/answer dependence, and issue-generation disclosure review. Establish baseline before optimization.

### 6. Build the first French curriculum slice

Use CEFR Pre-A1/A1 action-oriented descriptors to build one end-to-end, age-11-appropriate capability slice with listening/speaking/reading/writing evidence, safe fictional identities, accessibility variants, delayed retrieval, transfer, and guardian controls.

### 7. Build a generated-activity validation harness

Check curriculum alignment, answerability, factual grounding, level, bias, accessibility, privacy, safety, rubric consistency, and leakage before an LLM-generated activity reaches a learner.

## Cross-goal gates

- No real learner data before goal 1 is reviewed and the necessary legal/guardian authority exists.
- Schemas precede persistent learner-model implementation.
- Tutor behavior and flow optimization require fixed mastery/evaluation definitions.
- The French slice is the first integration probe, not evidence of universal generality.
- Human review remains mandatory for safety/privacy boundaries, deployments, and external writes.

## Design review rubric

A design is ready to implement only if it names the learner outcome, population, evidence grade, uncertainty, privacy class, authority, failure modes, falsifiable learning and guardrail signals, accessible route, stopping behavior, and migration/recovery path.
