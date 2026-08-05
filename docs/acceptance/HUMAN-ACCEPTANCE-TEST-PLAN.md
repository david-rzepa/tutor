# Human-driven acceptance test plan

- Plan version: **3.5.0**
- Product baseline: repository `main` at or after goal #22
- Decision owner: the human acceptance owner; never the facilitating agent

## Contract

This plan uses scarce human attention only for judgments automation cannot make reliably: first-use comprehension, aesthetics, affordance clarity, perceived feedback and completion, confidence in controls, accessibility experience, and journey coherence. Unit, integration, schema, protocol, isolation, digest, and source-inspection checks are automated prerequisites and are never presented as human actions.

Use only synthetic personas and local fixtures. Store privacy-minimized checkpoints and evidence outside the repository and cloud-synced folders unless the tester explicitly chooses a private location. Never capture identity, real learner records, raw chat, secrets, or screenshots containing them.

Before each action, the facilitator states the expected experience and then asks the human to try exactly one thing. The human may give free-form feedback at any moment. Feedback is acknowledged immediately, sanitized into a concise item, and kept separate from observations and verdicts. The human alone assigns action outcomes, scenario verdicts, severities, and the final release decision.

## Automated prerequisite report

Before involving the human, the facilitator records the product commit, platform/browser, plan version, and access route; runs `npm test`; builds the three fixtures; verifies the loopback server responds; and confirms the disposable `test_only` workspace and checkpoint binding. A failed prerequisite blocks the human run but is not a human verdict.

Automated evidence covers network/origin policy, sandboxing, schemas, event sequencing, privacy minimization, authority/isolation, curriculum validity, conservative progress, migration/recovery, and checkpoint integrity. Report that evidence compactly; never ask the human to inspect developer tools, JSON, logs, digests, reason codes, source code, or command output.

## Availability and platforms

| Human-visible surface | Status |
|---|---|
| Three local tiny-assistant fixtures | Runnable on Windows |
| Protocol stop/safety enforcement | Automated prerequisite; no persistent learner-facing host controls |
| Curriculum explorer render and text summary | Runnable after agent setup |
| Unified onboarding-to-lesson application | Unavailable; critical journey coverage remains blocked |
| Agent-led browser conversation with inline activity history | Runnable on Windows after agent setup |
| Real learner/deployment feedback flows | Prohibited pending deployment-specific authority |
| macOS/Linux experience | Unobserved |

Supported test browsers are current Chromium or Edge on Windows. Other browsers are exploratory. No child or real learner participates; an adult may assess the synthetic child and pre-reader experiences.

## Preflight and reset

1. Use the exact product checkpoint on `main`; record only non-identifying environment facts.
2. Run every automated prerequisite without delegating it to the human.
3. Create a disposable `tutor.workspace/v1` manifest with an opaque `workspace_id` and `test_only: true`.
4. Build the fixtures and verify `node src/interactive-assistant-harness/server.js 41739` on its printed loopback URL. For `scn_browser_session`, use the tutor skill's private temporary activity root plus `server-cli.js`/`session-cli.js` setup instead of exposing its capabilities or commands to the human.
5. Initialize the checkpoint with plan version `3.5.0`, the exact product commit, opaque run ID, disposable manifest, and `--synthetic-confirmed`. Older checkpoints fail closed because progressive activity disclosure, optional provenance, the required opening learner turn, and tutor-led progression change the human actions and expected journey.
6. Reset by reloading a fresh fixture or rebuilding an in-memory explorer model. Stop the server normally. Delete checkpoint or workspace state only with the plan's exact confirmation boundaries.

## Feedback workflow

- Accept feedback immediately in ordinary language, even while an action is active.
- Acknowledge the point before returning to the action. Do not force feedback into an observation category or verdict.
- Store only a concise privacy-safe paraphrase, feedback kind, and optional scenario/action reference; never raw chat or identity.
- At run end, show the complete feedback register, merge duplicates only with human approval, and let the human mark any item non-actionable.
- Convert every approved actionable item into a durable ZzzOps goal using `$add-zzzops-goal`. Preserve the originating scenario/action, desired user outcome, observable acceptance evidence, and critical constraints. Complete goal capture before asking for the final go/no-go decision.

## Result rules

- `pass`: every required action was observed and all experiential pass criteria hold.
- `fail`: a runnable experience diverged. Default severity is `major` for a broken or inaccessible core journey and `minor` for a recoverable presentation defect. A stop/safety failure is `blocking`.
- `blocked`: a named user-facing capability or required environment is unavailable. This is coverage debt, not a pass.
- `skipped`: the human deliberately omitted a runnable scenario.

Evidence references may name privacy-safe local artifacts such as `screens/first_use.png`; do not put observations or identity into filenames.

## Human scenario index

| ID | Human judgment | Status |
|---|---|---|
| `scn_first_use` | comprehension, aesthetics, and perceived completion | runnable |
| `scn_interaction` | affordances, feedback, help, pointer/keyboard parity | runnable |
| `scn_access` | keyboard-only and reduced-motion experience | runnable |
| `scn_explorer` | visual/non-visual comprehension and orientation | agent setup required |
| `scn_browser_session` | one-window conversation, inline activity history, and connection recovery | agent setup required |

## Scenario cards

### `scn_first_use` — immediate understanding and visual quality

Setup: fresh URLs for all three fixtures. Reset: reload each URL. Default failure severity: major for incomprehensible completion; minor for recoverable visual polish.

1. `act_orient`: Open each fixture without further instruction and pause before interacting. Expected: the activity is the only visible surface—there is no technical host title, status, or Start/Pause/Stop chrome. The first stage shows one direct question and one `Continue` action; answer controls are not competing for attention yet. Within a few seconds, the purpose, available action, and subject are understandable; wording feels learner-facing rather than technical. Science and music declare the age-11 persona, while math demonstrates an explicit adult alternative. No wording implies ability, diagnosis, or a fixed learning style.
2. `act_visual`: Compare the three initial screens at a comfortable browser size. Expected: the calm card, large controls, hierarchy, spacing, typography, contrast, and visible focus feel deliberate and readable; science, music, and math have distinct restrained accents without relying on color for meaning, clipping content, or adding decorative clutter.
3. `act_finish`: Complete one fixture and stop interacting. Expected: feedback is followed by a distinct `Activity complete` state, the response controls are gone, and the screen says there are no more questions in this activity.

Pass when all three experiences are understandable for their declared persona on first use, visually coherent, appropriately concise, and unambiguous at completion.

### `scn_interaction` — affordances, feedback, and help

Setup: fresh fixture URL. Reset: reload between attempts. Default failure severity: major for an inaccessible required operation; minor for recoverable presentation ambiguity.

1. `act_operate`: Complete the same target operation once with the pointer and once using only the keyboard. Expected: actionable elements are discoverable, focus is visible, both routes feel practical, and neither requires timing pressure.
2. `act_feedback`: Continue to the answer controls, try one incorrect response, and then retry. Expected: answer controls are replaced by one feedback-and-hint stage with one `Continue` action; continuing reveals fresh answer controls. Feedback is immediate, understandable, non-punitive, and makes the next action obvious without displaying the hint, feedback, and controls at once.
3. `act_help`: Before answering, use the visible `Help` button once. Expected: the answer controls are replaced by one short hint and one `Continue` action; continuing returns to fresh answer controls, the help action does not repeat, and reading/focus order moves forward without jumping around the page.

Pass when a learner can discover, operate, recover, and request support without developer knowledge or unexplained dead ends.

### `scn_access` — accessible experience

Setup: synthetic access persona; keyboard-only use and reduced-motion browser preference. Reset: restore normal preference and reload. Default failure severity: major.

For `act_motion` on Windows Chromium or Edge, do not look for an operating-system switch. Open browser DevTools with `Ctrl+Shift+I`, open its command menu with `Ctrl+Shift+P`, choose `Show Rendering`, and under **Emulate CSS media feature prefers-reduced-motion** select `prefers-reduced-motion: reduce`. The facilitator—not the human—confirms the active media query and records a privacy-safe setup reference before the action begins. After the observation, select `No emulation`; the facilitator confirms the media query is false and records reset evidence before completing the action. The human never inspects CSS, source, console output, or developer records. If setup or reset cannot be confirmed, mark the action blocked.

1. `act_keyboard`: Navigate and complete a fixture without pointer input. Expected: reading and focus order are logical, every required operation is reachable, status changes are perceivable, and focus never becomes lost.
2. `act_motion`: With the verified reduced-motion emulation active, use the fixture with browser reflow/zoom. Expected: these fixtures may look unchanged because they intentionally have no decorative animation; no meaning or operation depends on motion, layout remains understandable, and controls do not overlap or disappear.

Pass when the experience remains understandable and operable without pointer precision, motion, or a fixed viewport.

### `scn_explorer` — curriculum comprehension and orientation

Setup: the facilitator renders one synthetic curriculum explorer and equivalent text summary; the human is never asked to run or inspect commands. Reset: discard the synthetic render. Default failure severity: major; false mastery is blocking.

1. `act_views`: Explore the visual map and text/print view. Expected: each communicates the same topics, connections, route, plain-language progress, and brief uncertainty without technical provenance, evidence counts, or reliance on color alone.
2. `act_navigate`: Navigate by keyboard, switch synthetic subjects, and refresh once. Expected: labels and focus make location clear, the same node remains oriented when possible, and updates do not feel disorienting.
3. `act_truth`: Compare retained, learning, blocked, and contradictory-evidence examples. Expected: wording feels honest and understandable; time, clicks, or one success are never presented as mastery.
4. `act_control`: On a topic with prior progress, use `Revisit topic`. Expected: it is the only per-topic action, asks for confirmation before opening an activity, and nothing starts unexpectedly.

Pass when visual and non-visual experiences communicate equivalent meaning, preserve orientation, and present progress truthfully.

### `scn_browser_session` — browser-native Codex tutoring journey

Setup: the facilitator creates a fresh synthetic, memory-only session through the loopback harness, keeps the active Codex listener running, and opens the generated learner URL once. The learner is not shown or asked to handle capabilities, commands, logs, source packets, or generated files. Use an arbitrary subject that is not a checked-in fixture, such as cooking, and approved authoritative sources. Reset: end the session, stop the server normally, and discard only the exact temporary generated-activity directory. Default failure severity: major; cross-session disclosure, browser credential exposure, a stop failure, or an activity shown before validation is blocking.

1. `act_request`: Read the opening question, answer it once in the browser chat, and wait. Expected: Codex does not answer its own question or insert an activity before the learner replies. Waiting/connection feedback is understandable, and Codex responds in the browser without asking the learner to visit the Codex UI. Learning text is concise and learner-facing; citations are hidden by default under a clearly named `More info` disclosure when grounding materially supports the lesson.
2. `act_inline`: Continue until Codex offers the first generated activity, then use it. Expected: the activity appears inline in the chronological chat, is clearly connected to the conversation, and does not look like boxes nested inside boxes. It reveals one stage at a time—question, continue, answer controls, feedback/hint when needed, continue, retry or completion—while remaining sandboxed and fully operable without navigating away.
3. `act_continue`: Complete or attempt the first activity, then wait without selecting another topic. Expected: Codex receives the structured result, adapts without claiming mastery from one success, chooses and plainly explains the next valuable learning step, and adds the next response or validated activity after the prior history. The learner may ask a natural follow-up question, but is not made responsible for driving the curriculum.
4. `act_history`: Review the full page after at least two tutor responses and two activities. Expected: learner messages, tutor replies, optional source context, activities, results, and completion states form one understandable session history; learning-essential content is visible, parent/caregiver provenance remains available under `More info`, earlier activities remain readable, and no technical protocol, capability, curriculum ID, or developer control is visible.
5. `act_reconnect`: With the facilitator safely pausing and then restoring the Codex listener, observe the browser status without submitting private content. Expected: the browser plainly reports that it is waiting or disconnected, does not fabricate a response or lose existing history, and resumes in order without duplicate messages after the listener returns.
6. `act_end`: Use `End session`. Expected: the session ends promptly and unmistakably, further input is unavailable, existing history remains visible for the current page, and no raw chat is silently saved.

Pass when a learner can request an arbitrary grounded lesson, converse with Codex, use generated activities, recover orientation, and end the session while remaining in one understandable browser journey.

## Unavailable journey coverage

Do not simulate unavailable product journeys with module tests or command output. Report unified non-agent onboarding, deployment feedback, and untested platforms as unaccepted limitations. The browser-native Codex journey is runnable only after facilitator setup; automated component coverage and agent inspection do not replace its human verdict.

## Release-readiness summary

Report automated prerequisite status separately from human scenario verdicts. Include verdict counts, blocking failures, unavailable journey coverage, skipped scenarios, plan digest, product checkpoint, privacy-safe artifacts, and the reviewed feedback-to-goal register. The human corrects the summary and records exactly one decision: `go`, `conditional`, or `no-go`. No agent-generated summary or automated suite replaces that decision.
