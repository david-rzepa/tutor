# Synthetic walkthrough: age-11 beginner French

This trace demonstrates contract completeness without representing a real child or storing a transcript. It builds on the research [age-11 French example](../../research/learning-design/FRENCH-AGE-11.md).

## Frame

- Capability: ask and answer a simple question about likes using `J’aime…`, `Je n’aime pas…`, and `Tu aimes… ?`.
- Evidence need: distinguish recognition from cued and unaided production; no durable-mastery claim in-session.
- Assistant: **Café Choix**, a fictional café-order information-gap game with pictures, text, optional reviewed audio, keyboard/touch controls, captions, replay, pause, and stop.
- Privacy: synthetic fictional character and ephemeral choices; structured learning evidence only.

## Trace

1. Host sends `session.initialize` with target, reviewed nouns, misconception codes, accessibility settings, eight-attempt limit, and fallback content. Assistant returns `session.ready` and configuration digest.
2. A worked turn models `J’aime les pommes`, highlighting meaning and form. The learner then chooses the matching order correctly.
3. On production prompts, three responses omit the subject (`aime les pommes`). The assistant records `aimer_missing_subject`; help use rises.
4. Assistant sends `adaptation.requested`: observed pattern, hypothesis that full production exceeds current encoding, request to increase `scaffold` to recognition then sentence assembly, objective preserved.
5. Agent accepts through `adaptation.applied`, changing only scaffold. It does not lower the evidence standard or lengthen the session.
6. The learner completes one contrast choice, builds `J’aime les pommes`, then answers a different fictional character with a faded first-word cue.
7. A novel item asks `Tu aimes le football ?`; the learner produces an accepted answer without a cue. The assistant gives concise selective correction only if meaning or the current target requires it.
8. Assistant offers a truthful completion: today’s target was used once unaided, but it needs later practice. Learner can stop; no streak or continue pressure appears.
9. `evidence.summarized` returns attempts by scaffold, the recurring misconception, rising-then-falling help, stable latency, one unaided novel response, adaptations and stop reason. It declares delayed evidence insufficient.
10. Agent updates uncertain state and schedules a spaced listening/production retrieval with a changed context. It may briefly answer questions in chat, then chooses another interactive assistant for the later check.

## Failure branch

If the bounded agent response misses its deadline, Café Choix uses its reviewed sentence-builder fallback, reports a recoverable timeout, and continues without freezing. If audio fails, captions/text remain available. If the learner stops, the assistant immediately emits `session.stop` and no further generation or adaptation occurs.

## Trace assertions

- Every message type and causal transition is defined in [ASSISTANT-CONTRACT.md](ASSISTANT-CONTRACT.md).
- The adaptation follows [FLOW-CONTROLLER.md](FLOW-CONTROLLER.md): repeated target errors, one scaffold change, then fade and novel confirmation.
- The assistant teaches through action; the agent supplies diagnosis and policy rather than narrating the lesson.
- The result is compact evidence, not a raw exchange, engagement score, or mastery declaration.

## Contrasting population scenarios

### Early childhood / pre-reader

A caregiver-mediated tablet activity uses large semantic picture controls, short reviewed audio, turn-taking with physical objects, and no open agent conversation or reading demand. The child selects an object after hearing a phrase; the caregiver controls launch, audio, stop, and any record. Sessions are brief and do not use streaks or persuasive rewards. If the target cannot be validly assessed without adult observation, the assistant records only a caregiver-authorized rubric result. This is a design pattern, not permission to collect a baby’s data or bypass guardian authority.

### Adult learner

An adult preparing for travel chooses an efficient role-play simulation, can inspect the target/rationale, skip mastered material, request explicit grammar, and correct the learner model. The same contract supports denser text and learner-controlled pace without assuming expertise, motivation, vision, hearing, literacy, or digital access from age alone.

### Accessibility / non-screen route

For a learner who cannot use the visual café or drag controls, the host selects semantic buttons/list input, keyboard/switch navigation, captions or text in place of non-auditory audio, and spoken or alternative input for non-writing objectives. If the objective is pronunciation or sound discrimination, removing audio would change the construct; the system states that limitation and selects reviewed human/device support rather than reporting equivalent mastery. A screen is never mandatory when an off-screen object, caregiver, teacher, or conversation activity better serves the objective.

These scenarios follow the research [lifespan defaults and disability workflow](../../research/learning-design/AGE-ACCESSIBILITY-SAFETY.md).
