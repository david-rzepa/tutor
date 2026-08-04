# Platform decision

## Decision

Begin with sandboxed local web applications inside a trusted host. Use a transport-neutral protocol with a browser adapter first. Package reusable UI, protocol, evidence, accessibility, feedback, and teaching mechanics as a shared toolkit; assistants should mostly be template configuration plus curriculum content.

## Rationale

- Web UI supports rapid tailored interaction across desktop/tablet form factors and standard accessibility semantics.
- Local execution gives immediate scripted feedback and a strong default privacy/offline boundary.
- A narrow host bridge can validate all agent and learner-record traffic.
- Transport neutrality preserves future native, process, test, or remotely hosted adapters without changing pedagogical semantics.

## Alternatives

| Alternative | Strength | Why not first |
|---|---|---|
| Agent-rendered chat/widgets | trivial orchestration | encourages chat-first teaching, weak mechanics reuse, agent latency in common path |
| Native app/plugin runtime | stronger device integration | slower iteration and platform fragmentation before the contract is proven |
| Remote hosted micro-apps | central rollout and analytics | expands network, identity, child-data, availability, and deployment boundaries |
| Arbitrary generated HTML | maximum flexibility | unacceptable security, accessibility, validation, and reproducibility risk |

## Trust boundary

Assistant code and generated content are untrusted. Run under a restrictive CSP/origin, no ambient credentials, no arbitrary network, no direct learner-record access, capability-gated device APIs, size/time quotas, versioned assets, and a validated message allowlist. The host owns persistence and strips secrets/identifiers before messages cross the boundary.

## Falsifiable validation signal

The platform decision succeeds when two different assistant types reuse the same host/toolkit, complete a synthetic adaptation round trip under acceptable interaction latency, operate offline after asset load, pass keyboard/screen-reader-critical tests, and cannot escape the declared capabilities. Reconsider if the sandbox cannot provide a required accessible interaction or if agent callbacks dominate ordinary turns.
