# Interactive assistant harness

A dependency-free local host for sandboxed, domain-neutral learning activities.

```powershell
node src/interactive-assistant-harness/server.js 41739
```

Open the printed loopback URL. The included classification fixture proves the bridge; the examples directory supplies cross-domain on-demand activities.

After building examples, append `?card=<activity-id>` to launch either a configured template card or a validated generated application immediately through the same sandbox and protocol. The host adds no visible title, status, or persistent Start/Pause/Stop chrome around the activity; status remains available to assistive technology, while protocol-level stop and safety enforcement remain in the bridge.

## Browser-native Codex sessions

The tutor skill can run the harness as a learner-facing conversation rather than a single direct card. `server-cli.js` starts the loopback host and emits one private bootstrap capability. `session-cli.js create` exchanges it for separate learner and agent capabilities; the learner URL contains only the learner capability in its URL fragment, while the active Codex task retains the agent capability.

The active Codex task calls `session-cli.js wait` as a bounded long-poll and heartbeat. Learner chat, activity attempts, help, and stop events arrive as ordered structured events. Codex waits for the learner's opening reply before it may send a validated `activity.inline` event. Optional approved sources travel as bounded tutor-message metadata and stay collapsed under `More info`; they do not clutter the learning text. The browser renders messages and progressively disclosed activities chronologically and keeps prior sandboxed activities in the in-memory session history. The harness makes no direct OpenAI API call.

Arbitrary subjects use `src/tutor-core/session-planner/session-cli.js` to validate an approved grounded-source packet, construct the curriculum/readiness state, and invoke the deterministic tutor orchestrator. Card configurations are piped to `activity-cli.js`, which applies the existing validator and publishes only into the server's temporary generated-activity root. The complete executable procedure and privacy rules live in the [tutor skill](../../.agents/skills/tutor/SKILL.md).

## Trust boundary

- The server binds to `127.0.0.1`, rejects non-loopback Host headers, exposes only allowlisted static mounts, rejects traversal/symlinks, and sends restrictive CSP/security headers. Assistant scripts/styles are allowed only from the dynamic loopback origin so they can load inside an opaque-origin sandbox; `connect-src` remains `none`.
- Browser sessions use distinct unguessable learner, agent, and bootstrap capabilities. Capabilities are memory-only, role-scoped, bounded, and cannot be crossed between sessions. An expired agent heartbeat is shown as disconnected and never produces a fabricated response.
- Assistants run in an iframe with `sandbox="allow-scripts"`; there is no same-origin, forms, popups, navigation, network, device, profile, credential, or filesystem capability.
- Because a sandbox without `allow-same-origin` has opaque origin `null`, outbound host messages use `postMessage(..., "*")`; the trusted bridge accepts inbound messages only from the exact launched `contentWindow` and origin `null`, then validates the protocol/privacy grant.
- The fixture is intentionally tiny: one configured prompt, one mechanic, one view, no bespoke asset or dependency.

## Workspace boundary

`workspace.js` validates a user-selected `tutor.workspace/v1` root, confines paths, rejects escapes, stages checkpoints in `LocalStateRoot`, and publishes uniquely named verified records. Assistants receive no path or file API. It implements only host checkpoint needs; the broader repository/migration service remains a separate implementation slice from the [workspace design](../../docs/design/workspace-layout/README.md).

Run `npm test` to validate protocol, bridge, server, browser-session ordering/isolation, grounded planning, CLI round trips, workspace security, and accessible-shell behavior.
