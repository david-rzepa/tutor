import { createHash } from "node:crypto";

const ID = /^[a-z][a-z0-9_-]{2,79}$/;
const STATES = new Set(["unknown", "notice_presented", "pending", "active", "suspended", "denied", "revoked", "expired"]);
const ROLES = new Set(["adult_self", "verified_guardian", "caregiver_delegate"]);
const RELATIONSHIPS = new Set(["self_declared", "guardian_verified", "delegation_verified"]);
const POPULATIONS = new Set(["adult", "minor", "pre_reader", "unknown"]);
const NOTICE_ROUTES = new Set(["semantic_text", "screen_reader", "spoken", "printable", "caregiver_mediated"]);
const PROFILE_CAPABILITIES = new Set(["profile.collect", "profile.inspect", "profile.correct", "profile.export", "profile.use"]);
const DATA_CLASSES = new Set(["profile_authority", "profile_access", "profile_goals", "profile_pedagogy"]);
const INPUT_ROUTES = new Set(["keyboard", "touch", "switch", "speech", "caregiver_assisted"]);
const OUTPUT_ROUTES = new Set(["text", "screen_reader", "audio", "print", "caregiver_mediated"]);
const SUPPORTS = new Set(["no_time_pressure", "large_targets", "reduced_motion", "high_contrast", "short_instructions", "repeat_audio", "non_audio_equivalent", "non_drag_equivalent"]);
const SESSION_FORMS = new Set(["short", "standard", "flexible", "unknown"]);
const FORBIDDEN = /(name|email|phone|address|diagnosis|disability|condition|biometric|device_fingerprint|transcript|raw_response|learning_style|iq|secret|token|password)/i;

export class ProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProfileError";
    this.code = code;
  }
}

function assertId(value, field) {
  if (typeof value !== "string" || !ID.test(value)) throw new ProfileError("invalid_id", `${field} must be an opaque ID`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function scan(value, trail = "value") {
  if (typeof value === "string") {
    if (value.length > 160 || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)) throw new ProfileError("private_content", `${trail} contains unbounded or identifying text`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry, index) => scan(entry, `${trail}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new ProfileError("forbidden_inference", `${trail}.${key} is not allowed in a learner profile`);
    scan(entry, `${trail}.${key}`);
  }
}

function iso(value, field) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new ProfileError("invalid_time", `${field} must be an ISO timestamp`);
  return Date.parse(value);
}

export function validateAuthority(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new ProfileError("invalid_authority", "Authority record is required");
  if (record.schema !== "tutor.profile-authority/v1") throw new ProfileError("invalid_authority", "Unsupported authority schema");
  for (const field of ["authority_version", "user_ref", "actor_ref", "policy_version", "notice_version", "purpose"]) assertId(record[field], field);
  if (!STATES.has(record.state) || !ROLES.has(record.actor_role) || !RELATIONSHIPS.has(record.relationship_method) || !POPULATIONS.has(record.population)) throw new ProfileError("invalid_authority", "Authority state, role, relationship, or population is invalid");
  if (!Array.isArray(record.capabilities) || record.capabilities.some((item) => !PROFILE_CAPABILITIES.has(item))) throw new ProfileError("invalid_authority", "Authority capabilities are invalid");
  if (!Array.isArray(record.data_classes) || record.data_classes.some((item) => !DATA_CLASSES.has(item))) throw new ProfileError("invalid_authority", "Authority data classes are invalid");
  if (!record.notice || !NOTICE_ROUTES.has(record.notice.access_route) || record.notice.comprehension_confirmed !== true || record.notice.rights_explained !== true || record.notice.core_learning_without_consent !== true) {
    throw new ProfileError("inaccessible_notice", "Accessible notice, comprehension, rights, and a no-consent learning route are required");
  }
  if (record.population === "pre_reader" && !["spoken", "caregiver_mediated"].includes(record.notice.access_route)) throw new ProfileError("inaccessible_notice", "Pre-reader notice requires a spoken or mediated route");
  if (record.population === "minor" && record.actor_role !== "verified_guardian") throw new ProfileError("authority_inference", "Minor authority requires an explicitly verified guardian record");
  if (record.population === "pre_reader" && !["verified_guardian", "caregiver_delegate"].includes(record.actor_role)) throw new ProfileError("authority_inference", "Pre-reader authority requires an explicit guardian or delegation record");
  if (record.actor_role === "adult_self" && record.relationship_method !== "self_declared") throw new ProfileError("authority_inference", "Adult self authority requires the declared self relationship");
  if (record.actor_role === "verified_guardian" && record.relationship_method !== "guardian_verified") throw new ProfileError("authority_inference", "Guardian authority must be explicitly verified");
  if (record.actor_role === "caregiver_delegate" && record.relationship_method !== "delegation_verified") throw new ProfileError("authority_inference", "Caregiver capability must be explicitly delegated");
  if (record.actor_role === "caregiver_delegate" && record.capabilities.includes("profile.export")) throw new ProfileError("authority_inference", "Caregiver delegation cannot imply profile export authority");
  if (record.supersedes !== null && record.supersedes !== undefined) assertId(record.supersedes, "supersedes");
  iso(record.effective_at, "effective_at");
  iso(record.expires_at, "expires_at");
  if (record.provenance !== "synthetic") throw new ProfileError("real_profile_blocked", "Only synthetic profile authority is permitted");
  scan(record);
  return Object.freeze(stable(record));
}

export function decideProfileCapability(authorityInput, request, { now }) {
  let authority;
  try { authority = validateAuthority(authorityInput); } catch (error) {
    return { decision: "deny", authority_version: null, reason_codes: [error.code ?? "invalid_authority"] };
  }
  const reasons = [];
  if (authority.user_ref !== request.user_ref) reasons.push("user_scope_mismatch");
  if (authority.purpose !== request.purpose) reasons.push("purpose_mismatch");
  if (!authority.capabilities.includes(request.capability)) reasons.push("capability_missing");
  if (!authority.data_classes.includes(request.data_class)) reasons.push("data_class_missing");
  const moment = iso(now, "now");
  if (moment < Date.parse(authority.effective_at)) reasons.push("not_yet_effective");
  if (moment >= Date.parse(authority.expires_at)) reasons.push("authority_expired");
  if (authority.population === "unknown") reasons.push("authority_unknown");
  if (authority.state !== "active") reasons.push(`authority_${authority.state}`);
  return stable({
    decision: reasons.length ? (["suspended", "pending", "notice_presented"].includes(authority.state) ? "suspend" : "deny") : "allow",
    authority_version: authority.authority_version,
    purpose: request.purpose,
    capability: request.capability,
    data_class: request.data_class,
    expires_at: authority.expires_at,
    reason_codes: reasons.length ? reasons : ["active_grant", "minimum_scope"],
    notice_access_route: authority.notice.access_route,
    audit_event_id: `aud_${hash({ authority: authority.authority_version, request, now }).slice(0, 16)}`
  });
}

export function validateProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new ProfileError("invalid_profile", "Profile must be an object");
  const allowed = new Set(["schema", "profile_version", "user_ref", "authority_version", "age_band", "goals", "access", "preferences", "hypotheses", "provenance", "parent_version"]);
  for (const key of Object.keys(profile)) if (!allowed.has(key)) throw new ProfileError("unknown_field", `Unknown profile field: ${key}`);
  if (profile.schema !== "tutor.learner-profile/v1") throw new ProfileError("invalid_profile", "Unsupported profile schema");
  for (const field of ["profile_version", "user_ref", "authority_version"]) assertId(profile[field], field);
  if (profile.parent_version !== null) assertId(profile.parent_version, "parent_version");
  if (!["early_childhood", "child", "adolescent", "adult", "unknown"].includes(profile.age_band)) throw new ProfileError("invalid_age_band", "Age band must be explicit or unknown");
  if (!Array.isArray(profile.goals) || !profile.goals.length || profile.goals.some((goal) => !["subject_id", "outcome_id", "context_id"].every((key) => ID.test(goal[key])))) throw new ProfileError("invalid_goal", "Goals require opaque subject, outcome, and context IDs");
  if (!profile.access || profile.access.input_routes?.some((route) => !INPUT_ROUTES.has(route)) || profile.access.output_routes?.some((route) => !OUTPUT_ROUTES.has(route)) || profile.access.supports?.some((support) => !SUPPORTS.has(support))) throw new ProfileError("invalid_access", "Access settings use unknown routes or supports");
  if (!Array.isArray(profile.access.input_routes) || !profile.access.input_routes.length || !Array.isArray(profile.access.output_routes) || !profile.access.output_routes.length) throw new ProfileError("invalid_access", "At least one input and output route is required");
  if (!profile.preferences || !SESSION_FORMS.has(profile.preferences.session_form) || profile.preferences.evidence_role !== "preference_only") throw new ProfileError("stereotype_risk", "Preferences must remain preference-only");
  if (!Array.isArray(profile.hypotheses)) throw new ProfileError("invalid_hypothesis", "Hypotheses must be an array");
  for (const hypothesis of profile.hypotheses) {
    if (!["skill_id", "hypothesis_code", "next_observation"].every((key) => ID.test(hypothesis[key])) || !Number.isFinite(hypothesis.confidence) || hypothesis.confidence < 0 || hypothesis.confidence > 1 || !Array.isArray(hypothesis.alternative_codes) || hypothesis.alternative_codes.some((id) => !ID.test(id))) throw new ProfileError("invalid_hypothesis", "Hypotheses require bounded confidence, alternatives, and a falsifying observation");
    iso(hypothesis.observed_at, "observed_at"); iso(hypothesis.expires_at, "expires_at");
  }
  if (profile.provenance !== "synthetic") throw new ProfileError("real_profile_blocked", "Only synthetic profiles are permitted");
  scan(profile);
  return Object.freeze(stable(profile));
}

export function completeOnboarding({ authority, profile, now }) {
  const validatedAuthority = validateAuthority(authority);
  const decision = decideProfileCapability(validatedAuthority, { user_ref: profile.user_ref, purpose: "learning_profile", capability: "profile.collect", data_class: "profile_goals" }, { now });
  if (decision.decision !== "allow") return { status: "stopped", decision, profile: null };
  const validatedProfile = validateProfile(profile);
  if (validatedProfile.authority_version !== validatedAuthority.authority_version) throw new ProfileError("stale_authority", "Profile authority version does not match the active decision");
  const ageMatchesPopulation = validatedAuthority.population === "adult" ? validatedProfile.age_band === "adult"
    : validatedAuthority.population === "minor" ? ["child", "adolescent"].includes(validatedProfile.age_band)
      : validatedAuthority.population === "pre_reader" ? validatedProfile.age_band === "early_childhood"
        : validatedProfile.age_band === "unknown";
  if (!ageMatchesPopulation) throw new ProfileError("population_mismatch", "Declared age band and authority population are inconsistent");
  const initialRoute = {
    objective_id: validatedProfile.goals[0].outcome_id,
    principle_ids: ["clear_goal", "retrieval_feedback", "spaced_check"],
    age_determined_level: false,
    diagnostic_required: true
  };
  return { status: "complete", decision, profile: validatedProfile, initialRoute };
}

export class ProfileRepository {
  #histories = new Map();
  #authorities = new Map();
  #currentAuthority = new Map();

  registerAuthority(authority) {
    const validated = validateAuthority(authority);
    const current = this.#currentAuthority.get(validated.user_ref);
    if (current && validated.supersedes !== current) throw new ProfileError("authority_version_conflict", "New authority must supersede the current version");
    this.#authorities.set(validated.authority_version, validated);
    this.#currentAuthority.set(validated.user_ref, validated.authority_version);
  }

  #authorize({ userRef, authorityVersion, capability, now, actorRef = null }) {
    const authority = this.#authorities.get(authorityVersion);
    if (this.#currentAuthority.get(userRef) !== authorityVersion) throw new ProfileError("stale_authority", "Authority version has been superseded");
    if (actorRef !== null && authority?.actor_ref !== actorRef) throw new ProfileError("cross_user_denied", "Actor does not control this user authority");
    const decision = decideProfileCapability(authority, { user_ref: userRef, purpose: "learning_profile", capability, data_class: capability === "profile.use" ? "profile_access" : "profile_goals" }, { now });
    if (decision.decision !== "allow") throw new ProfileError("authority_denied", decision.reason_codes.join(","));
    return decision;
  }

  append({ profile, actorRef, now }) {
    const validated = validateProfile(profile);
    this.#authorize({ userRef: validated.user_ref, authorityVersion: validated.authority_version, capability: this.#histories.has(validated.user_ref) ? "profile.correct" : "profile.collect", now, actorRef });
    const history = this.#histories.get(validated.user_ref) ?? [];
    const current = history.at(-1);
    if ((current?.profile_version ?? null) !== validated.parent_version) throw new ProfileError("version_conflict", "Correction must descend from the current profile version");
    if (history.some((entry) => entry.profile_version === validated.profile_version)) throw new ProfileError("version_collision", "Profile version is immutable");
    history.push(validated); this.#histories.set(validated.user_ref, history);
    return validated.profile_version;
  }

  inspect({ userRef, actorRef, authorityVersion, now }) {
    this.#authorize({ userRef, authorityVersion, capability: "profile.inspect", now, actorRef });
    return (this.#histories.get(userRef) ?? []).map(stable);
  }

  export(options) {
    this.#authorize({ userRef: options.userRef, authorityVersion: options.authorityVersion, capability: "profile.export", now: options.now, actorRef: options.actorRef });
    return { schema: "tutor.profile-export/v1", user_ref: options.userRef, profiles: (this.#histories.get(options.userRef) ?? []).map(stable) };
  }

  projectForAssistant({ userRef, authorityVersion, now, ephemeralProfileRef, objectiveId }) {
    assertId(ephemeralProfileRef, "ephemeralProfileRef"); assertId(objectiveId, "objectiveId");
    this.#authorize({ userRef, authorityVersion, capability: "profile.use", now });
    const current = this.#histories.get(userRef)?.at(-1);
    if (!current) throw new ProfileError("profile_not_found", "No current profile exists");
    return stable({ schema: "tutor.activity-profile-slice/v1", ephemeral_profile_ref: ephemeralProfileRef, objective_id: objectiveId, age_band: current.age_band, access: current.access, session_form: current.preferences.session_form });
  }
}

export function revokeAuthority(authorityInput, { actorRef, at }) {
  const authority = validateAuthority(authorityInput);
  if (authority.actor_ref !== actorRef) throw new ProfileError("authority_denied", "Only the recorded authority actor can revoke this synthetic grant");
  return validateAuthority({ ...authority, authority_version: `aut_${hash({ prior: authority.authority_version, at }).slice(0, 16)}`, supersedes: authority.authority_version, state: "revoked", effective_at: at, expires_at: authority.expires_at });
}

export function classifyObservation({ correct, interface_error = false, access_barrier = false, model_error = false, repeated_independent = false }) {
  if (interface_error || access_barrier) return { classification: "access_barrier", update_knowledge: false };
  if (model_error) return { classification: "model_error", update_knowledge: false };
  if (!correct && repeated_independent) return { classification: "knowledge_gap_hypothesis", update_knowledge: true };
  if (!correct) return { classification: "uncertain_single_observation", update_knowledge: false };
  return { classification: "successful_observation", update_knowledge: true };
}

export function profileToPublicOutput() {
  throw new ProfileError("public_profile_forbidden", "Profiles have no public-output projection");
}

export async function persistProfileVersion({ workspaceRepository, profile, parentHeads = [] }) {
  const validated = validateProfile(profile);
  if (!workspaceRepository || typeof workspaceRepository.publish !== "function") throw new ProfileError("workspace_required", "Trusted workspace repository is required");
  if (!Array.isArray(parentHeads) || parentHeads.some((head) => !ID.test(head))) throw new ProfileError("invalid_parent_heads", "Workspace parent heads must be opaque IDs");
  return workspaceRepository.publish({
    userId: validated.user_ref,
    kind: "profile",
    recordId: validated.profile_version,
    payload: validated,
    parents: parentHeads
  });
}

export async function readPersistedProfile({ workspaceRepository, userRef, profileVersion, expectedDigest = null }) {
  assertId(userRef, "userRef"); assertId(profileVersion, "profileVersion");
  if (!workspaceRepository || typeof workspaceRepository.read !== "function") throw new ProfileError("workspace_required", "Trusted workspace repository is required");
  const record = await workspaceRepository.read({ userId: userRef, kind: "profile", recordId: profileVersion, expectedDigest });
  return validateProfile(record.payload);
}
