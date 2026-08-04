# Teaching tools

Dependency-free ESM primitives for domain-neutral interactive teaching assistants.

```js
import {
  createEnvelope,
  createSessionState,
  reduceSession,
  recommendScaffold,
  summarizeEvidence
} from "@tutor/teaching-tools";
```

The package implements the transport-neutral contract in [ASSISTANT-CONTRACT.md](../../docs/design/interactive-assistants/ASSISTANT-CONTRACT.md). It contains no curriculum, identity, learner-profile, persistence, UI, network, or transcript logic.

## Design constraints

- Validate every message at the trusted host boundary.
- Keep common interaction deterministic and local.
- Require deadlines and reviewed fallbacks for agent callbacks.
- Let assistants request pedagogical adaptations; the agent applies or replaces them.
- Return observations and an explicit delayed-evidence limitation, never an in-session mastery declaration.
- Inject objective, content, rubric, misconception codes, population settings, and accessible presentation through configuration.

Run `npm test` from the repository root.
