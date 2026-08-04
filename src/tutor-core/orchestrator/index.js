const ID = /^[a-z][a-z0-9_.:-]{2,127}$/;

export class TutorDecisionError extends Error { constructor(code, message) { super(message); this.name = "TutorDecisionError"; this.code = code; } }
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

function selectObjective(candidates) {
  const eligible = candidates.filter((item) => item.ready && item.safety_allowed && item.access_fit);
  return eligible.sort((a, b) =>
    Number(b.verification_due) - Number(a.verification_due) ||
    b.expected_learning_value - a.expected_learning_value ||
    b.goal_path - a.goal_path || b.prerequisite_leverage - a.prerequisite_leverage ||
    b.uncertainty_reduction - a.uncertainty_reduction || b.flow_fit - a.flow_fit || a.node_id.localeCompare(b.node_id)
  )[0] ?? null;
}

export function decideTutorAction(input) {
  if (input?.schema !== "tutor.orchestration-input/v1") throw new TutorDecisionError("invalid_input", "Versioned orchestration input is required");
  if (input.authority?.decision !== "allow") return stable({ action: "stop", reason_codes: ["authority_not_active"], fallback: "public_or_synthetic_only", updates: [] });
  if (input.control?.stop || input.control?.consent_withdrawn || input.control?.safety_stop) return stable({ action: "stop", reason_codes: [input.control.consent_withdrawn ? "consent_withdrawn" : input.control.safety_stop ? "safety_stop" : "learner_stop"], fallback: "reviewed_stop", updates: [] });
  if (input.control?.pause) return stable({ action: "pause", reason_codes: ["learner_pause"], fallback: "resumable_checkpoint", updates: [] });
  const objective = selectObjective(input.candidates ?? []);
  if (!objective) return stable({ action: "stop", reason_codes: ["no_safe_accessible_ready_objective"], fallback: "human_or_offscreen_plan", updates: [] });
  if (!ID.test(objective.node_id) || !ID.test(objective.rubric_version) || !ID.test(objective.content_version)) throw new TutorDecisionError("invalid_objective", "Selected objective requires versioned opaque IDs");

  const recent = input.recent ?? {};
  let action = "launch_assistant"; let adaptation = "hold"; const reasons = [objective.verification_due ? "delayed_verification_due" : "highest_expected_learning_value"];
  if (recent.learner_question) { action = "answer_then_assistant"; reasons.push("learner_question"); }
  if (recent.known_misconception) { action = "tailored_mini_assistant"; adaptation = "contrast_misconception"; reasons.push("misconception_repair"); }
  else if (recent.access_barrier || recent.interface_error) { action = "substitute_assistant"; adaptation = "change_access_route"; reasons.push("access_not_knowledge"); }
  else if ((recent.consecutive_target_errors ?? 0) >= 2 && (recent.help_count ?? 0) > 0) { adaptation = "increase_one_scaffold"; reasons.push("persistent_error"); }
  else if (recent.guided_success && !recent.independent_success) { adaptation = "fade_one_support"; reasons.push("guided_success_not_mastery"); }
  else if (recent.fast_accurate && recent.weak_transfer) { adaptation = "vary_context"; reasons.push("verify_transfer"); }

  const masteryUpdate = recent.varied_independent && recent.delayed_retained && recent.transfer_success ? "eligible_for_projection" : "no_mastery_claim";
  return stable({
    action, objective: { node_id: objective.node_id, graph_id: input.graph_id, rubric_version: objective.rubric_version, content_version: objective.content_version },
    assistant_slice: { ephemeral_profile_ref: input.ephemeral_profile_ref, node_id: objective.node_id, access_route: objective.access_route, capabilities: ["attempt.recorded", "adaptation.requested", "session.stopped"] },
    adaptation, reason_codes: reasons, mastery_update: masteryUpdate,
    callback: { deadline_ms: 1500, fallback: "reviewed_local_activity", max_requests: 1 },
    schedule: objective.verification_due ? "record_verification_result" : masteryUpdate === "eligible_for_projection" ? "next_ready_objective" : "delayed_unaided_check",
    correction: { allowed: true, fields: ["reason_codes", "access_route", "objective_selection"] },
    updates: [{ type: "decision_audit", graph_id: input.graph_id, projection_version: input.projection_version }]
  });
}
