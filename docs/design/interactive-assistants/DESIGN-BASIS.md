# Design basis and uncertainty

This file routes consequential decisions to the durable research layer. Grades use the [evidence grading contract](../../research/learning-design/EVIDENCE-GRADING.md); a strong learning mechanism does not automatically validate this product implementation.

| Design decision | Basis | Evidence / uncertainty |
|---|---|---|
| require retrieval before reveal, then feedback and later attempts | [P01–P02](../../research/learning-design/PRINCIPLES.md#p01-make-retrieval-do-teaching-work) | strong for retrieval/spacing; effects depend on prior encoding, feedback, delay, difficulty, and outcome |
| use worked examples and fade for novices | [P04](../../research/learning-design/PRINCIPLES.md#p04-show-fade-then-vary-worked-examples) | strong/moderate synthesis; tune for prior knowledge and element interactivity |
| make feedback alter the next attempt | [P05](../../research/learning-design/PRINCIPLES.md#p05-feedback-must-change-the-next-attempt) | moderate-to-strong synthesis; timing and content are contextual |
| adapt challenge from errors/help/latency while changing one variable | [flow controller](../../research/learning-design/TUTOR-INTERACTION.md#flow-controller) | flow evidence is substantially correlational; treat as a falsifiable policy hypothesis and secondary diagnostic |
| measure delayed retention/transfer, not activity completion | [primary KPI](../../research/learning-design/PROGRESS-EVALUATION.md#primary-kpi-time-to-demonstrated-mastery) | grounded in strong learning evidence; the project’s exact composite KPI requires baseline/calibration |
| reject fixed visual/auditory/kinesthetic profiles | [anti-principle](../../research/learning-design/PRINCIPLES.md#explicit-anti-principle-do-not-assign-fixed-learning-styles) | strong critical review against matching hypothesis; preferences and accessibility needs still matter |
| preserve accessible routes without changing the construct | [accessibility workflow](../../research/learning-design/AGE-ACCESSIBILITY-SAFETY.md#accessibility-is-capability-not-style) | standards/framework basis; each implementation still needs usability and construct-validity testing |
| use meaningful interaction plus selective L2 correction | [French rules](../../research/learning-design/FRENCH-AGE-11.md#language-specific-design-rules) | moderate L2 syntheses; feedback efficacy varies by target, proficiency, mode, and learner |
| minimize child data and keep public issues synthetic/aggregated | [privacy loop](../../research/learning-design/PRIVACY-FEEDBACK.md) | policy plus moderate review; jurisdiction, consent authority, retention, and disclosure thresholds need reviewed design |
| put validation/sandbox/fallback around generated activities | [P09](../../research/learning-design/PRINCIPLES.md#p09-put-a-pedagogical-harness-around-generative-ai) | risk-based design inference; must be validated by escape, hallucination, accessibility, and learning tests |

## Open design hypotheses

- Local web mini-apps will outperform chat-first instruction for suitable action/retrieval tasks on mastery time without access or well-being harm.
- Bounded agent callbacks will add useful personalization without disrupting interaction continuity.
- A shared teaching toolkit will support materially different mechanisms without forcing invalid uniformity.

Goal #4 must falsify these with synthetic technical/accessibility tests first; later consented evaluation compares delayed outcomes and guardrails. Failure should change the platform or responsibility split, not be hidden by engagement metrics.
