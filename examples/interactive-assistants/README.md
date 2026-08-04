# On-demand interactive assistants

The agent has two first-class ways to make a small activity:

1. generate bounded JSON for the reviewed card template;
2. generate a tiny self-contained HTML/CSS/JS app when custom interaction is useful.

Both paths are validated against [budget.js](budget.js), run in the same opaque-origin sandbox, use `tutor.assistant/v1`, and fall back to [fallback.json](fallback.json) when validation fails.

Every reviewed activity declares a learner persona. `age-11` is the child-facing acceptance baseline; `adult` and `caregiver-mediated` are explicit alternatives. A persona controls wording and presentation choices only—it must not be used to infer ability, diagnosis, or a fixed learning style. Prompts should read as direct questions with an obvious response action.

The shared visual system uses calm cards, large controls, strong visible focus, and a restrained subject accent: green for science, purple for music, and blue for adult math. Labels and structure carry every meaning; color and motion never act as the only signal.

## Build the synthetic examples

```powershell
node examples/interactive-assistants/build.js config examples/interactive-assistants/configs/science-change.json
node examples/interactive-assistants/build.js config examples/interactive-assistants/configs/music-order.json
node examples/interactive-assistants/build.js app examples/interactive-assistants/sources/adult-math-app
node src/interactive-assistant-harness/server.js 41739
```

Open one of:

- `http://127.0.0.1:<port>/?card=science_change`
- `http://127.0.0.1:<port>/?card=music_order`
- `http://127.0.0.1:<port>/?card=adult_math_recall`

The examples span science choice, music ordering, and an adult-directed mental-math app generated as application code. They have one objective/mechanic, one view plus feedback/help/complete states, no runtime dependencies or bespoke media, and synthetic curriculum references only.

## Generated-code boundary

Generated application code is allowed. The validator currently permits at most four flat HTML/CSS/JS/JSON files totaling 24 KiB, rejects external URLs, network/storage/device APIs, dynamic code evaluation, inline scripts, missing semantic structure, incompatible protocol code, excess states/callbacks, and unsafe paths. These are first-milestone budgets, not a claim that future assistants can never be richer.
