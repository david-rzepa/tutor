# ZzzOps project policy audit

Status: complete. Reviewer: david rzepa. Revision: 4.

## Evidence and decisions

- [x] `[policy:backend]` **Canonical goal backend** (applicable)
  - Decision: github_issues
  - Rationale: The authenticated GitHub repository david-rzepa/tutor is usable, issues are enabled, and the user explicitly requires privacy-safe progress analysis to become repository issues.
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps GitHub-only authority → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"authority": "github_issues", "capability_evidence": "Authenticated GitHub repository david-rzepa/tutor is usable, issues are enabled, and the viewer has ADMIN permission.", "fallback": "forbidden", "repository_identity": "david-rzepa/tutor", "tradeoffs": {"github_issues": "shared native issue queue requiring GitHub access"}}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:git_review_release]` **Git, review, and release** (applicable)
  - Decision: Use main as the single implementation branch, with one Conventional Commit per verified sub-goal after required dependencies are integrated. Do not create per-goal branches or pull requests unless the user or repository explicitly requires one.
  - Rationale: The user explicitly requested direct main-branch execution to remove repeated per-goal review gates while retaining verification, self-review, and dependency controls.
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.; E-003: user policy adjustment on 2026-08-04 — Use main as the implementation branch and continue executing the approved goal queue without per-goal branches by default.
  - Confidence/default: medium; ZzzOps first-release fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"branch_base": "main", "child_target": "main", "commit_style": "conventional", "commit_unit": "verified_subgoal", "conversational_approval": "allowed_otherwise", "dependency_base": "main_after_dependency_integration", "execution_branch": "main", "merge_after_approval": "not_applicable_for_direct_main", "multiple_dependency_base": "main_after_all_dependency_integration", "parent_pseudo_trunk": false, "pr_approval": "only_when_explicitly_requested_or_repository_required", "pull_request_unit": "none_by_default", "read_only_dependency_investigation": "allowed_before_completion", "review_gate": "human_after_checks", "review_pending_dependency": "wait_for_completed_dependencies", "review_state_reads_per_checkpoint": 1, "shared_pull_request": "explicit_user_or_repository_requirement"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:execution_continuation]` **Execution and work continuation** (applicable)
  - Decision: Continue across actionable goals under reviewed dependency and resource policy, and incorporate newly captured goals at the next safe checkpoint.
  - Rationale: reduces babysitting without forcing sequential work when bounded parallelism is safe
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps first-release fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"after_additive_capture": "resume_once_and_reprioritize", "continue_while_actionable": true, "cross_task": "require_explicit_harness_signal", "execute_intent": "same_task_until_superseded", "exhausted_handoff_retains_intent": true, "human_unblock_watch": {"enabled": false, "max_blockers": 1, "max_seconds": 180, "notify_once": true, "poll_seconds": 30, "trigger": "disabled_for_unattended_execution"}, "max_easy_wins": 2, "new_goal_checkpoint": "next_safe_checkpoint", "stop_reasons_clear_intent": ["user_stop", "pause", "replacement_request", "capture_only", "required_authority", "blocking_boundary"], "triage_new_first": true}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:verification_testing]` **Verification and testing** (applicable)
  - Decision: Require artifact-appropriate observable evidence in small chunks; documentation and test cases need no recursive tests, while product behavior and reusable test infrastructure require direct verification.
  - Rationale: prevents unobservable product changes and false confidence without manufacturing documentation or test meta-tests
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: high; ZzzOps observable-work fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"artifact_verification": {"documentation": "inspect_artifact_no_feature_test", "product_runtime": "risk_proportionate_behavioral_probe", "test_cases": "run_changed_tests_no_recursive_meta_test", "test_harness": "focused_behavioral_regression"}, "ci_deduplication": {"failure": "inspect_logs_and_reprobe", "local_probe": "smallest_unique_falsifiable_signal", "required_ci": "inspect_exact_pr_head", "skip_broad_local_when": "same_command_required_ci", "unavailable": "durable_blocker"}, "mode": "chunk_probe", "test_bug": "capture_and_ask", "widen": "as_relevant"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:code_quality]` **Code-quality and refactoring boundaries** (applicable)
  - Decision: Preserve behavior unless a goal explicitly authorizes a behavior change.
  - Rationale: separates cleanup from product decisions
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps conservative fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"completion_self_review": "required_before_review_or_done", "dead_code": "remove_only_if_evidenced_and_in_scope", "dynamic_generated_vendor": "retain_without_proof", "non_behavioral_only_without_feature_goal": true, "record_clean_review": true, "reverify_after_changes": true, "review_scope": "goal_diff_tests_and_relevant_surroundings"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:dependencies_tooling]` **Dependencies, tooling, and generated artifacts** (applicable)
  - Decision: Use project-native tooling; do not hand-edit generated or dependency-owned files.
  - Rationale: The repository has no project-native tooling yet; retain the conservative default until tooling is introduced and evidenced.
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps conservative fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"dependency_changes": "explicit_scope", "generated_files": "source_or_generator_only", "tooling": "project_native"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:security_privacy_compliance]` **Security, privacy, secrets, and compliance** (applicable)
  - Decision: Repository policy may tighten but never weaken ZzzOps safety and authority boundaries.
  - Rationale: record applicable project constraints without making safety optional
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; immutable ZzzOps boundary → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"production_mutation": "explicit_authority", "project_constraints": ["privacy-safe learning analytics", "strict multi-user profile and progress isolation", "no personally identifying or sensitive learner content in GitHub issues"], "secrets": "never_expose"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:documentation_style]` **Documentation and style** (applicable)
  - Decision: Follow evidenced repository documentation, style, and user-communication conventions.
  - Rationale: keep communication project-appropriate while providing a concise ZzzOps fallback
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps fallback overridden by repository or user evidence → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"communication": {"style": "outcome_first", "technical_detail": "decision_risk_failure_or_request", "user_action": "one_clear_action_with_reason_and_next_step"}, "documentation": "repository_conventions", "style": "repository_conventions"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:deployment_resources]` **Deployment, environment, and resources** (applicable)
  - Decision: Do not deploy without authority; choose bounded parallelism from the deterministic tracked-file repository size.
  - Rationale: limits external impact and avoids multiplying large writable checkouts
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps conservative fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"delegate_wait_after_seconds": 60, "deployment": "explicit_authority", "resource_mode": "size_aware"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:automated_design]` **Automated design authority** (applicable)
  - Decision: enabled
  - Rationale: Allow unattended execution to resolve reversible in-scope design choices when reviewed project evidence is decisive, while retaining consequential authority gates.
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps bounded automated-design fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"decision_record": ["alternatives", "rationale", "assumptions", "falsifiable_validation_signal"], "hard_stops": ["product_scope", "incompatible_public_contract", "destructive_migration", "external_spending", "deployment", "external_write", "human_review", "safety_authority", "higher_authority"], "insufficient_evidence": "durable_design_blocker", "privacy_security": "unambiguously_risk_reducing_without_material_behavior_change", "scope": "reversible_in_scope_implementation", "selection_basis": ["project_objectives", "kpi_evidence", "constraints", "precedence"]}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:autonomy_approval_parallelism]` **Autonomy, approvals, and parallelism** (applicable)
  - Decision: Interview adaptively during goal capture; execute unattended by persisting consequential questions as durable blockers; refill valuable bounded work; use up to three worktree workers below 100 MB and read-only workers otherwise.
  - Rationale: balances precise capture, unattended execution, authority, bounded valuable refill, and predictable repository resource cost
  - Sources: E-002: user policy interview and agent synthesis — Manage curricula, interactive teaching assistants, profiles, and progress for multiple users; optimize learning speed; analyze outcomes and publish privacy-safe GitHub issues; allow broad automated design within safety and authority gates.
  - Confidence/default: medium; ZzzOps conservative fallback → accepted
  - Provenance: adopted from the recorded ZzzOps default
  - Settings: `{"blocker_interview": "capture_only", "blocker_order": ["safety_access_human", "cross_goal_decisions", "specification", "technical_unknown"], "capture_defaults": {"confidence": "low", "difficulty": "unknown", "priority": "P2"}, "claim_ttl_hours": 4, "dependency_implementation_gate": "dependencies_done", "execution_reports": {"enabled": true}, "max_workers": 3, "parallelization": {"at_or_above_threshold_mode": "read_only", "below_threshold_mode": "worktrees", "measurement": "existing_git_tracked_worktree_bytes", "threshold_bytes": 104857600}, "planning": {"decompose_at": "L", "max_depth": 3}, "project_parallel_ceiling": "size_aware", "read_only_dependency_investigation": true, "refill": {"allowed_categories": ["documentation", "tests", "code_quality_non_behavioral"], "enabled": true, "max_per_run": 3}, "requirements_interview": {"capture_depth": "standard", "execution_questions": "durable_blockers_only", "mode": "adaptive", "stakeholder_model": "requesting_user_only"}, "resource_reservations": {"exclusive_prefixes": ["generated", "external"], "exclusive_resources": [], "mode": "conflict_tolerant"}, "worktree_lifecycle": {"abandoned_or_dirty": "forbidden", "after_task": "remove_or_retain_clean_for_reuse", "reuse_requires": ["clean_state", "reviewed_base", "new_goal_resources", "safe_branch_reassignment"]}}`
  - Exceptions: none
  - Unresolved: none

## Review record

| Date | Actor/run | Change | Reason/evidence |
| --- | --- | --- | --- |
| 2026-08-03 | ZzzOps initialization | Created pending revision 1 | Confirmed agent-generated draft; explicit policy review still required. |
| 2026-08-03 | david rzepa | Reviewed policy revision 2 | Approved: backend, git_review_release, execution_continuation, verification_testing, code_quality, dependencies_tooling, security_privacy_compliance, documentation_style, deployment_resources, automated_design, autonomy_approval_parallelism; source digest sha256:c4107399e80bc03b32631fe568b2114c09f8d5aa005a7a1528d900a3c2a35fad. |
| 2026-08-04 | ZzzOps initialization | Created pending revision 3 | Confirmed agent-generated draft; explicit policy review still required. |
| 2026-08-04 | david rzepa | Reviewed policy revision 4 | Approved: git_review_release; source digest sha256:694af1e6e1df484863295ddc6db6517927c0eb560719fb7cbb7f274ae83d523c. |

The machine-readable authority is [POLICY.json](POLICY.json); this file is its human audit view.
