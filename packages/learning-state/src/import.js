import { CurriculumValidationError, isSafeId, validateEvidenceEvent } from "../../curriculum-model/src/index.js";

export function importEvidence({ event, target, authorization, compatibility, uncertainty_mapping }) {
  validateEvidenceEvent(event);
  if (authorization?.approved !== true || !isSafeId(authorization.authority_id)) throw new CurriculumValidationError(["explicit import authority is required"]);
  if (compatibility?.compatible !== true || !isSafeId(compatibility.mapping_id) || compatibility.source_node_id !== event.node_id || compatibility.target_node_id !== target?.node_id) throw new CurriculumValidationError(["explicit semantic compatibility mapping is required"]);
  if (!target || !["event_id", "user_id", "curriculum_id", "graph_id", "node_id"].every((field) => isSafeId(target[field]))) throw new CurriculumValidationError(["complete opaque target identity is required"]);
  if (!uncertainty_mapping || typeof uncertainty_mapping.factor !== "number" || uncertainty_mapping.factor <= 0 || uncertainty_mapping.factor > 1 || !isSafeId(uncertainty_mapping.rule_id)) throw new CurriculumValidationError(["bounded uncertainty mapping is required"]);
  const imported = {
    ...structuredClone(event), ...target,
    uncertainty: { confidence: event.uncertainty.confidence * uncertainty_mapping.factor },
    provenance: [...new Set([...event.provenance, authorization.authority_id, compatibility.mapping_id, uncertainty_mapping.rule_id])],
    imported_from: { event_id: event.event_id, user_id: event.user_id, curriculum_id: event.curriculum_id, graph_id: event.graph_id, node_id: event.node_id },
    import_authority: authorization.authority_id, compatibility_mapping: compatibility.mapping_id, uncertainty_mapping: uncertainty_mapping.rule_id
  };
  return validateEvidenceEvent(imported);
}
