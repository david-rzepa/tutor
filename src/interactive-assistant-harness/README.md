# Interactive assistant harness

A dependency-free local host for sandboxed, domain-neutral learning activities.

```powershell
node src/interactive-assistant-harness/server-cli.js
```

Open the printed loopback URL. The included classification fixture proves the bridge; goal #8 supplies the cross-domain on-demand activity examples.

## Trust boundary

- The server binds to `127.0.0.1`, rejects non-loopback Host headers, exposes only allowlisted static mounts, rejects traversal/symlinks, and sends restrictive CSP/security headers. Assistant scripts/styles are allowed only from the dynamic loopback origin so they can load inside an opaque-origin sandbox; `connect-src` remains `none`.
- Assistants run in an iframe with `sandbox="allow-scripts"`; there is no same-origin, forms, popups, navigation, network, device, profile, credential, or filesystem capability.
- Because a sandbox without `allow-same-origin` has opaque origin `null`, outbound host messages use `postMessage(..., "*")`; the trusted bridge accepts inbound messages only from the exact launched `contentWindow` and origin `null`, then validates the protocol/privacy grant.
- The fixture is intentionally tiny: one configured prompt, one mechanic, one view, no bespoke asset or dependency.

## Workspace boundary

`workspace.js` validates a user-selected `tutor.workspace/v1` root, confines paths, rejects escapes, stages checkpoints in `LocalStateRoot`, and publishes uniquely named verified records. Assistants receive no path or file API. It implements only host checkpoint needs; the broader repository/migration service remains a separate implementation slice from the [workspace design](../../docs/design/workspace-layout/README.md).

Run `npm test` to validate protocol, bridge, server, workspace, security, and accessible-shell behavior.
