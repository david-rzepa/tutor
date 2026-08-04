# Learning feedback reference

Dependency-free synthetic reference implementation for the consented efficacy loop.

- `createAuthority` provides purpose-level grant/withdraw/inspect state.
- `SyntheticFeedbackStore` enforces authority, user isolation, export, and deletion.
- `validateFeedbackRecord` rejects raw/private material and requires synthetic versioned provenance.
- `analyzeSyntheticFeedback` separates immediate, delayed, transfer, velocity, and guardrail signals with minimum-cohort suppression.
- `createIssueDraft` renders fixed, privacy-scanned aggregate prose.
- `prepareExactPayload` and `sendExactlyConfirmed` make an injected external writer unreachable without exact payload confirmation.

No real-data or GitHub integration is included while B-001 is open.
