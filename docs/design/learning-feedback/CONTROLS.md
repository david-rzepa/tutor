# Authority and learner controls

Authority is a versioned state machine per subject and purpose. `grant` or `withdraw` records controller, purpose, effective time, status, and monotonic revision. The store checks current authority at ingestion and analysis; withdrawal stops future processing without silently rewriting historical audit facts.

The subject can inspect and export retained structured records and delete their own records. Cross-subject inspect, export, or deletion is rejected. Real deployments must additionally implement reviewed authentication, guardian relationships, retention schedules, backup/provider deletion limits, correction, incident response, and deletion receipts; the synthetic in-memory reference does not claim those deployment guarantees.

Purposes are independent: teaching improvement, learning measurement, and accessibility quality never imply one another. Transcript-derived processing is absent, not merely disabled in a UI.
