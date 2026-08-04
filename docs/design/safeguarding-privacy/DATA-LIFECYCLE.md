# Data lifecycle and access matrix

## Classes

| Class | Examples | Default |
|---|---|---|
| `public_design` | principles, synthetic fixtures, reviewed non-identifying findings | repository allowed after disclosure review |
| `learning_record` | opaque curriculum IDs, structured attempts, rubrics, progress projections | isolated local workspace; purpose/retention bound |
| `restricted` | identity/authority proof, raw conversation, disability/health detail, voice/image, precise schedule/location | do not collect until essential and explicitly approved |
| `secret` | tokens, credentials, private endpoints, encryption keys | secret store only; never learner content/prompts/issues |

Pseudonymous data remains personal/re-identifiable. Rare combinations, exact timestamps, small groups, longitudinal paths, and quotations can disclose identity.

## Lifecycle gates

1. **Specify:** outcome, minimum fields, class, purpose, authority, access roles, retention/deletion rule, provider route, and falsifiable need.
2. **Notice/decide:** render accessible notice; record active authority and assent where applicable.
3. **Collect:** schema-validate and minimize before persistence. Reject undeclared/raw fields.
4. **Use:** capability check every read/write; assistants get only a current-node slice.
5. **Derive:** separate observation from inference; bind source versions, uncertainty, privacy class, and correction path.
6. **Share/export:** preview exact scope; verify requester/recipient/format; exclude secrets and unauthorized namespaces.
7. **Retain:** enforce the approved event-based schedule. “Useful later” is not a duration.
8. **Correct/revoke:** append correction/authority events; stop new affected processing immediately and invalidate caches/capabilities.
9. **Delete:** preview consequences, verify scope/authority, delete authorized objects and derivatives, rebuild projections, and produce a non-sensitive verification record. Legal holds are a human-reviewed exception.

## Access matrix

`A` means a separate active capability may allow; `—` means default deny.

| Actor | authority/identity | structured learning | raw conversation/media | aggregate product finding | public write |
|---|---:|---:|---:|---:|---:|
| learner | A: own inspect/correct/export | A: own | A only if separately approved | — | — |
| verified guardian | A under reviewed relationship policy | A for represented learner | A only if essential/separate | — | — |
| educator/caregiver | — unless delegated | A: minimum assigned view | — | — | — |
| tutor agent | — | A: current slice/event | — | — | — |
| sandboxed assistant | — | A: ephemeral configuration/result | — | — | — |
| local repository service | A: opaque routing only | A: storage operations | A only in approved restricted zone | — | — |
| maintainer/evaluator | — | — by default | — | A after disclosure controls | A after explicit external-write review |

## Export, correction, and deletion

- Export uses a documented portable manifest, accessible summary, provenance, and machine-readable records; it excludes secrets and other users.
- Correction never rewrites evidence silently. Append a correction/supersession and rebuild derived state.
- Deletion explains that progress/readiness may change without obstructing the right. It covers authoritative objects, projections/caches, pending provider jobs, backups under the approved schedule, and public links where removal is possible.
- A failure at any boundary leaves the request resumable and quarantines partial output; it never reports successful deletion/export without verification.

## External providers and public issues

No provider receives learner data until its purpose, fields, region, subprocessors, logging/training behavior, retention/deletion, incident terms, credentials, and fallback are approved. Provider denial/failure uses local reviewed fallback or clean stop.

Public issue generation requires synthetic reproduction where possible, minimum-group/disclosure rules when aggregates are approved, removal of direct/indirect identifiers and quotes, secret/PII scanning, human privacy review at the approved risk tier, exact-payload external-write authority, and a non-sensitive local linkage. Repository visibility never makes restricted evidence safe.
