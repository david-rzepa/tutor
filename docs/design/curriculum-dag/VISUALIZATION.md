# Visualization and healthy gamification

## Default view

Show a calm goal-directed map centered on:

- destination/goal and current meaningful milestone;
- two to five ready/review-due choices;
- just enough prerequisites/dependents to explain why;
- distinct states for learning, provisional, retained, transfer-verified, blocked, optional, and needs-review;
- brief, plain-language uncertainty when progress needs another check;
- at most one contextual `Revisit topic` action on a node with prior progress.

Large graphs use semantic zoom, filtering, and progressive disclosure; they do not render an intimidating wall of hundreds of nodes by default.

## Visual encoding

Use label + icon/shape + pattern, never color alone. Edge arrows have text alternatives. Layout is deterministic per graph/version to preserve orientation. Animation is brief, optional, and respects reduced motion. Do not imply a single route when alternatives exist.

## Accessible equivalent

The complete operation is available as a keyboard/switch-operable outline/table:

```text
Subject goal
  Predict a simple change — Remembered after a break — Revisit topic
  Trace relationships — Learning
  Explain feedback systems — Not started — Comes after trace relationships
```

Screen-reader users can navigate the same topic and prerequisite order as the visual map. Focus never jumps after projection refresh; updates use concise live status. A text summary can be spoken, printed, or used with a teacher/caregiver.

## Healthy gamification

Allowed:

- truthful milestone celebration tied to retained/transfer evidence;
- visible map discovery, bounded route choice, personal best against one’s prior evidence, and optional themes;
- collections of demonstrated capabilities with provenance and uncertainty;
- cooperative/guardian acknowledgement when learner-controlled and privacy-safe.

Forbidden:

- streak loss, countdown pressure, variable/random rewards, loot/energy systems, shame, leaderboards by default, social comparison for children, artificial scarcity, hidden completion inflation, or blocking stop;
- points for time-on-screen/clicks or graph traversal without learning evidence;
- confetti/“mastered” labels on provisional performance;
- manipulating graph granularity to create more rewards.

Celebration ends naturally and never opens the next activity automatically. Flow is a secondary tie-breaker under the [flow guardrails](../interactive-assistants/FLOW-CONTROLLER.md#anti-compulsion-rules).
