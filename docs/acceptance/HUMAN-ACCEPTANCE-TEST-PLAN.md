# Human-driven acceptance test plan

- Plan version: **1.0.0**
- Product baseline: repository `main` at or after goal #22
- Decision owner: the human acceptance owner; never the facilitating agent

## Contract

This plan evaluates the current tutor as a set of local, composable product journeys. It does not certify a deployment. Use only synthetic personas and a disposable `tutor.workspace/v1` root chosen for the run. Store checkpoints/evidence outside the repository and cloud-synced folders unless the tester has explicitly chosen a private location. Never capture names, contact details, real learner records, raw chat, screenshots containing identity, secrets, or public issue payloads.

The facilitator presents one action without its expected result, records the tester's observation category, and only then reveals the expectation below. The human alone assigns action outcomes, scenario verdicts (`pass`, `fail`, `blocked`, `skipped`), severities, and final `go`, `no-go`, or `conditional` decision.

## Availability and platforms

| Surface | Status for this plan |
|---|---|
| Local sandboxed host, three tiny assistants, pause/stop/access controls | Runnable now on Windows |
| Synthetic profile, authority, curriculum, orchestrator, repository, and lifecycle modules | Runnable now with command assistance |
| Unified non-developer onboarding-to-lesson application | Unavailable; record affected journey as blocked |
| Visual/non-visual curriculum explorer (#19) | Gated until #19 is done |
| Real learner feedback, transcript collection, aggregate disclosure, public issues (#5) | Prohibited pending deployment-specific H-001–H-008 authority |
| macOS/Linux product run | Unobserved; fixtures/tests are portable claims, not human acceptance |

Supported test browsers are current Chromium or Edge on Windows. Record other browsers as exploratory. Required roles are one acceptance owner and, for child/pre-reader scenarios, one adult acting as synthetic guardian/caregiver. No child or real learner participates.

## Preflight and reset

1. Check out the exact product checkpoint on `main`; record the commit hash, Windows/browser versions, plan version, and access route without personal identity.
2. Confirm Node.js 22 or newer and run `npm test`. A failure blocks product scenarios but is not itself a human acceptance verdict.
3. Create a disposable directory containing `workspace.json` with opaque `workspace_id` and `test_only: true`. Never point lifecycle/deletion actions at the repository or a real workspace.
4. Build the fixtures with the three commands in `examples/interactive-assistants/README.md`, then run `node src/interactive-assistant-harness/server.js 41739`. Use the printed loopback URL.
5. Initialize the facilitator checkpoint outside the repository with the plan file, version `1.0.0`, product commit, disposable `workspace.json`, opaque run ID, and `--synthetic-confirmed`. The helper rejects a workspace not explicitly marked `test_only` and records no path.
6. Before every scenario, reset only its synthetic records or rebuild the disposable fixture. Stop the loopback server normally. Lifecycle deletion is allowed only after its exact preview is reviewed and only for the disposable root. The checkpoint helper deletes only its own file after exact run-ID confirmation.

## Synthetic personas

| ID | Persona and authority | Subject fixture | Access route |
|---|---|---|---|
| `per_adult` | Adult self-authority; uncertain prior knowledge | mental mathematics | keyboard and pointer |
| `per_child` | Age-11 fictional learner; synthetic guardian grants scoped authority | science: reversible/irreversible change | keyboard, reduced motion |
| `per_prereader` | Pre-reader; synthetic caregiver mediates instructions and responses | music ordering | read-aloud/delegate, non-timed |
| `per_access` | Adult with a declared interaction barrier, no diagnosis | any of the above | keyboard-only or non-visual substitute |

Do not infer learning style, diagnosis, intelligence, or fixed ability from these fixtures.

## Result rules

- `pass`: every required action was observed and all pass criteria hold.
- `fail`: runnable behavior diverged. Default severity is `blocking` for safety/privacy/isolation/data loss/stop failures, `major` for a broken core learning journey or inaccessible required route, and `minor` for recoverable presentation defects.
- `blocked`: the action could not run because a named capability, authority, or environment prerequisite is unavailable. This is coverage debt, not a pass or product defect.
- `skipped`: the human deliberately omitted a runnable scenario and records why outside the privacy-minimized checkpoint.

Evidence references name local artifacts only, such as `screens/teach_success.png` or `records/run_a_summary.json`; do not put observations or identity into filenames. A release candidate has no human-assigned blocking failures, no unexplained major failures, and no unacknowledged blocked critical coverage. These rules inform the human; they do not compute the decision.

## Scenario index

| ID | Journey | Persona/subject | Status |
|---|---|---|---|
| `scn_shell` | host and tiny assistant | all three subjects | runnable |
| `scn_onboard` | authority, profile, curriculum correction | adult, child, pre-reader | command-assisted |
| `scn_adapt` | error simplification, success fading, misconception/question bridge | cross-domain | command-assisted + browser |
| `scn_control` | pause, stop, and inaccessible substitution | access persona | runnable |
| `scn_learning` | delayed retention/transfer and conservative progress | adult math | command-assisted |
| `scn_privacy` | isolation, minimization, revocation, transcript boundary | two users | command-assisted |
| `scn_recovery` | migration, backup, tamper detection, restore | disposable workspace | command-assisted |
| `scn_explorer` | equivalent DAG and non-visual progress | any | gated by #19 |
| `scn_external` | feedback/public-issue boundary | synthetic | prohibited by #5 authority gate |

## Scenario cards

### `scn_shell` — local host and tiny assistants

Setup: server running; fixture URLs for `adult_math_recall`, `science_change`, and `music_order`. Reset: reload a fresh fixture URL. Default failure severity: major; sandbox/network escape is blocking.

1. `act_launch`: Open each fixture. Expected after observation: one small, subject-distinct activity loads without remote assets, sign-in, profile/path disclosure, or full-game setup. Inspect: browser network shows loopback/local assets only.
2. `act_operate`: Complete one item using pointer, then keyboard. Expected: focus is visible, status/feedback is perceivable, and the same target operation is possible without timing pressure.
3. `act_help`: Request help and retry. Expected: one bounded scaffold appears without revealing a full answer history or leaving the single activity surface.

Pass when all three subjects launch, the activity remains tiny and understandable, required controls work, and no remote/identity capability appears. Inspect the structured ready/attempt/help/complete events for session and sequence validity without identity. Capture at most one sanitized screenshot per subject, an event-schema summary, and a network-origin summary.

### `scn_onboard` — authority, profile, curriculum, and correction

Setup: fresh synthetic repository; use module tests or a thin command driver for `src/tutor-core/profiles` and `src/tutor-core/curricula`. Reset: remove only the disposable workspace. Default severity: blocking for authority/isolation, major otherwise.

1. `act_adult`: Initialize `per_adult` with self-authority, access preferences, and a math goal. Expected: an inspectable notice precedes consent; uncertain placement stays uncertain; an immutable private profile and subject curriculum version are created.
2. `act_child`: Initialize `per_child` through synthetic guardian authority. Expected: scoped guardian authority is explicit; child self-authority is not invented; age does not hard-code subject or ability.
3. `act_prereader`: Initialize `per_prereader` with caregiver/delegate access. Expected: the route is caregiver-mediated and non-text alternatives preserve the intended construct.
4. `act_correct`: Correct one goal/access preference and reject one placement inference. Expected: a new immutable version records provenance; unrelated goals and evidence do not change; the prior version remains inspectable.

Pass when all three populations complete through explicit authority, records remain isolated and correctable, and the generated DAGs are subject-grounded rather than age- or French-specific. Inspect authority/profile/curriculum schema and version IDs; capture a minimized version-lineage summary.

### `scn_adapt` — tailored teaching adaptations

Setup: synthetic ready node and reviewed activity; use orchestrator traces plus the matching fixture where visible. Reset: start a fresh deterministic session. Default severity: major.

1. `act_errors`: Submit the same plausible wrong operation repeatedly. Expected: exactly one variable changes toward an easier scaffold or prerequisite; difficulty does not collapse multiple dimensions and no mastery is claimed.
2. `act_success`: Complete a guided item successfully. Expected: one support fades; one helped success does not establish mastery.
3. `act_misconception`: Provide evidence matching a known misconception. Expected: the tutor requests a tiny contrast-and-test assistant tailored to that misconception.
4. `act_question`: Ask a concise learner question. Expected: the agent answers briefly, then returns to an interactive assistant when an action would clarify or consolidate the answer.

Pass when adaptations are inspectable, bounded to one variable, preserve access needs, and favor tailored mini-assistants over long chat. Inspect the decision reason codes, input versions, fallback, and next-verification fields; capture a sanitized decision summary.

### `scn_control` — learner control and access substitution

Setup: any running fixture plus a synthetic inaccessible-route signal. Reset: new session. Default severity: blocking for stop; major for access.

1. `act_pause`: Pause mid-attempt and resume. Expected: interaction stops changing while paused and resumes without duplicate evidence or lost learner control.
2. `act_stop`: Stop mid-attempt and try another event. Expected: the session remains stopped and rejects later teaching events.
3. `act_substitute`: Mark the current mechanic inaccessible. Expected: the route changes while the knowledge target/difficulty does not; access friction is not recorded as a knowledge error.

Pass when pause/resume is stable, stop is final, and an equivalent accessible route exists without lowering the learner model. Inspect sequence/checkpoint events and the access-substitution reason; capture a sanitized control-event summary.

### `scn_learning` — durable learning and progress interpretation

Setup: deterministic adult-math evidence trace with varied attempts. Reset: discard the synthetic trace. Default severity: major.

1. `act_immediate`: Record one independent in-session success. Expected: immediate performance improves but mastery remains unconfirmed.
2. `act_delay`: Advance the injected clock and perform an unaided delayed check. Expected: evidence is tied to the immutable graph/content versions and retention is reported separately.
3. `act_transfer`: Perform a different-context transfer item, then add contradictory evidence. Expected: transfer and contradiction affect the conservative projection; readiness explanations remain inspectable.

Pass when progress separates immediate performance, delayed retention, transfer, and uncertainty; speed/flow/completion alone never becomes mastery. Inspect immutable evidence/graph versions and the readiness explanation; capture the projection summary without response content.

### `scn_privacy` — isolation, minimization, and revocation

Setup: two opaque synthetic users in one disposable workspace. Reset: delete the disposable root only through lifecycle preview/confirmation. Default severity: blocking.

1. `act_isolate`: Read/publish as each user and attempt a cross-user read. Expected: own records succeed; cross-user access is denied without leaking content.
2. `act_slice`: Inspect an assistant initialization envelope. Expected: it has an ephemeral alias and current activity slice, but no identity, absolute path, full profile/history, authority record, or transcript.
3. `act_revoke`: Revoke one authority and retry affected profile use. Expected: revocation is append-only, inspectable, and immediately prevents that use.
4. `act_transcript`: Search the disposable workspace and checkpoint artifacts for the spoken/typed test phrase. Expected: no raw chat/transcript is retained; only structured authorized evidence exists.

Pass only when isolation fails closed, assistant data is minimized, revocation works, and raw dialogue is absent. Capture only schema keys, denial reason codes, and the negative transcript-search result.

### `scn_recovery` — migration, backup, and recovery

Setup: explicitly disposable `test_only: true` workspace with synthetic records; never a real workspace. Reset: retain source until verified, then remove test directories through exact preview. Default severity: blocking for loss/scope escape, major otherwise.

1. `act_migrate`: Plan and run copy/verify/switch migration with an injected interruption, then resume. Expected: source remains intact, staged bytes are digest-verified, and only the machine-local link switches.
2. `act_archive`: Create backup and scoped export, then inspect manifests. Expected: provenance and user scope are explicit; credentials, raw-reserved data, and other users are absent.
3. `act_tamper`: Change one archived byte and attempt restore. Expected: restore fails on digest mismatch without publishing a target.
4. `act_restore`: Restore an untampered archive and preview user deletion. Expected: round-trip records preserve provenance; deletion lists exact scope/recovery boundary and requires human authority plus exact confirmation.

Pass when interruption is resumable, tampering fails closed, exports preserve isolation, and no destructive action can escape the disposable root. Capture manifest/digest IDs, failure reason codes, and the privacy-safe deletion receipt—not paths or record bodies.

### `scn_explorer` — curriculum DAG and equivalent progress views

Status: gated by #19. Record one `unavailable` observation before expectation reveal, then human-assign `blocked` or `skipped`; do not simulate a pass. Expected after observation: visual and non-visual views expose the same immutable graph version, prerequisites, readiness explanation, progress, and keyboard/screen-reader actions without encoding graph position by color alone. Default blocked severity: major coverage debt.

### `scn_external` — feedback and public-write boundary

Status: prohibited until a named deployment has human-approved applicable H-001–H-008 decisions for #5. Record one `unavailable` observation and a human `blocked` verdict. Expected after observation: no real transcript collection, aggregate disclosure, or public GitHub issue write is available; any future external write must show the exact privacy-safe payload and digest for human confirmation. Default blocked severity: blocking coverage/authority gate, not a current product defect.

## Release-readiness summary

The facilitator produces counts by verdict, blocking failures, blocking coverage gates, per-scenario results, active/gated coverage, plan digest, product checkpoint, and artifact references. The human reviews missing scenarios and known unavailable capabilities, corrects any result, and records exactly one decision:

- `go`: accepted for the explicitly tested local scope only;
- `conditional`: named non-blocking conditions remain;
- `no-go`: a blocking failure, unacceptable major failure, or critical unknown prevents acceptance.

The summary must say that macOS/Linux, unified product onboarding, #19 explorer behavior, and #5 deployment feedback are unaccepted whenever they were not directly observed. No agent-generated summary is final until the human approves or corrects it.
