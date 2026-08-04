# Workspace lifecycle

Synthetic/disposable lifecycle operations layered on the trusted workspace repository: resumable copy/verify/switch migration, manifest-bound backup/export/restore, explicit multi-head reconciliation, authoritative cache rebuild, and exact-preview deletion.

Migration retains the source and switches only a machine-local link after complete digest verification. Export excludes operational, credential, cache, and raw-reserved zones. Unknown workspace versions restore read-only. Destruction is unavailable unless `workspace.json` explicitly says `test_only: true`, exact authority and preview bytes are confirmed, and the no-recovery boundary is acknowledged.
