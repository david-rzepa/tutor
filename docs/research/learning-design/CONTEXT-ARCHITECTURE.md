# Context architecture

This corpus follows progressive disclosure: a small router points to opinionated decision guides, which point to dense references. Do not load every file into an agent by default.

## Layers

1. **Router:** [README.md](README.md) states purpose, invariants, and which file answers which question.
2. **Decision guides:** focused files translate evidence into executable rules for one design surface.
3. **Matrix:** [EVIDENCE-MATRIX.md](EVIDENCE-MATRIX.md) supports quick claim/grade/source scanning.
4. **Source registry:** [SOURCES.md](SOURCES.md) deduplicates provenance and routes high-stakes readers to originals.
5. **Rich implementation references (future):** schemas, rubrics, fixtures, validated examples, and executable checks should live beside the component that owns them, with links from the relevant guide.

## Writing contract

- Put each rule in the narrowest file that owns the decision.
- Link instead of repeating. The router contains no literature review.
- Start with the decision; keep mechanism, moderators, failure, signal, and source compact.
- Prefer tables for repeated fields and schemas/rubrics for exact interfaces.
- Store examples only when they test a boundary or communicate higher fidelity than prose.
- Separate evidence strength from imperative language; policy constraints are not efficacy claims.
- Delete superseded duplication while preserving source/history through Git.
- Do not turn transient plans, conversations, or learner records into global context.

## Agent loading protocol

1. Read the router.
2. State the design question and affected population/context.
3. Load one decision guide and the relevant matrix rows.
4. Open original sources for consequential, disputed, high-stakes, or out-of-population use.
5. Record the selected principle, moderators, assumption, and falsifiable signal in the design/goal.
6. Load another guide only when a dependency is identified.

## Maintenance signal

A corpus change is healthy when an agent can reach the needed rule in one or two links, understand its limits without loading unrelated domains, and trace it to a stable source. Split a file when independent questions are routinely loaded separately; merge files when they repeat the same decision contract.

Anthropic's context-engineering guidance motivates the architecture: keep global instructions lightweight, avoid repeated/obvious constraints, use selective skills/files, and prefer high-fidelity references or rubrics over oversimplified prose. Treat that product guidance as an architecture input, not learning-science evidence. [S029](SOURCES.md#s029).
