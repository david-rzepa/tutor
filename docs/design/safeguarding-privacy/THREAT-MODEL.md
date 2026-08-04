# Threat model and synthetic assurance scenarios

## Assets and boundaries

Protect learner agency/well-being, identity/authority proof, isolated profiles/evidence, raw restricted material, provider payloads, exports/deletions, secrets, and public disclosures. Boundaries are learner/guardian UI, tutor agent, sandboxed assistant, trusted host, workspace repository/sync provider, evaluator, external AI/provider, and GitHub/public outputs.

## Abuse cases and controls

| Threat | Required control and observable negative scenario |
|---|---|
| cross-user read/write | namespace + capability binding at repository boundary; synthetic user B cannot address, infer, export, or delete user A |
| confused-deputy assistant/agent | opaque current-slice capability, strict protocol/schema, no ambient files/profile; prompt asks for identity/path and is rejected |
| stale/revoked consent | version/expiry checked on every capability; revoke during a session stops later events/provider jobs |
| guardian-role change/conflict | suspend affected processing; preserve learner stop/notice and reviewed rights workflow; old grant cannot reopen access |
| inaccessible/coercive notice | keyboard/screen-reader/plain-language/spoken/printable equivalents; refusal leaves core non-recording route available where feasible |
| raw transcript/media creep | schema and zone deny by default; transcript-like keys, quotes, voice/images, and raw response fields fail before persistence |
| indirect/public re-identification | disclosure review removes rare combinations, exact times, small groups, free text, and stable learner IDs; unsafe issue stays local |
| prompt/content injection | generated content cannot grant capabilities or change authority; external instructions remain untrusted data |
| sync/export leak | verified manifests, per-user selection, digest checks, recipient/scope preview; foreign object causes quarantine and no partial export |
| deletion illusion | enumerate authoritative/derived/provider/backup scope, fault-inject each boundary, rebuild, and verify inaccessible result |
| provider retention/training | approved contract/config plus payload audit; mismatch or unknown behavior denies transfer and uses fallback |
| safeguarding/dependency manipulation | no secrecy/dependency cues, advertising, streak pressure, or open contact; stop and route to an authorized human under reviewed playbook |
| secret leakage | secrets never enter learner zones/prompts/issues; automated scanning and credential rotation incident path |

## Synthetic population scenarios

1. **Independent adult:** accessible notice, local structured records, correction/export/revocation; no provider or public write. Expected: self-authority can activate only declared capabilities.
2. **Age-11 learner:** verified guardian policy is not configured. Expected: synthetic activity may run without durable learner data; record collection remains pending/denied and child stop works.
3. **Pre-reader/caregiver:** caregiver-mediated spoken/picture notice with printable alternative; no solitary screen trace. Expected: caregiver controls launch/record while child refusal stops the activity.
4. **Access need without diagnosis:** learner requests keyboard/spoken route. Expected: accommodation is recorded as a task preference, not health inference; mastery target is unchanged when construct permits.
5. **Guardian relationship changes mid-session:** expected suspension before next write, provider cancellation, non-sensitive audit, and no role inference by the agent.
6. **Maintainer requests a GitHub issue from a unique transcript:** expected denial; generate a synthetic reproduction or retain a private product hypothesis without external write.

## Incident boundary

On suspected exposure, authority bypass, unsafe interaction, or deletion failure: stop affected processing; isolate/quarantine without copying restricted content into logs; preserve minimum protected audit; invalidate capabilities/secrets as applicable; notify the designated authorized human through the reviewed channel; assess scope and required notices under deployment policy; remediate and verify before restart. The tutor does not investigate abuse, promise confidentiality, diagnose distress, contact authorities, or provide emergency/counseling services unless a separately reviewed jurisdictional playbook and authorized human owns that action.
