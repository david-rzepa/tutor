import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyObservation,
  completeOnboarding,
  decideProfileCapability,
  ProfileRepository,
  profileToPublicOutput,
  persistProfileVersion,
  readPersistedProfile,
  revokeAuthority,
  validateAuthority,
  validateProfile
} from "../../src/tutor-core/profiles/index.js";
import { openWorkspaceRepository } from "../../src/workspace-repository/index.js";

const now = "2026-08-04T12:00:00Z";

function authority({ user = "usr_alpha", population = "adult", role = "adult_self", relationship = "self_declared", route = "semantic_text", state = "active", version = "aut_version1", expires = "2027-08-04T00:00:00Z" } = {}) {
  return {
    schema: "tutor.profile-authority/v1", authority_version: version, user_ref: user, actor_ref: `act_${user.slice(4)}`,
    actor_role: role, relationship_method: relationship, population, state, purpose: "learning_profile",
    capabilities: ["profile.collect", "profile.inspect", "profile.correct", ...(role === "caregiver_delegate" ? [] : ["profile.export"]), "profile.use"],
    data_classes: ["profile_authority", "profile_access", "profile_goals", "profile_pedagogy"],
    notice_version: "not_v1", policy_version: "pol_v1",
    notice: { access_route: route, comprehension_confirmed: true, rights_explained: true, core_learning_without_consent: true },
    effective_at: "2026-08-04T00:00:00Z", expires_at: expires, supersedes: null, provenance: "synthetic"
  };
}

function profile({ user = "usr_alpha", authorityVersion = "aut_version1", version = "pro_version1", parent = null, age = "adult", supports = ["no_time_pressure"] } = {}) {
  return {
    schema: "tutor.learner-profile/v1", profile_version: version, parent_version: parent, user_ref: user, authority_version: authorityVersion, age_band: age,
    goals: [{ subject_id: "sub_generic", outcome_id: "out_apply", context_id: "ctx_personal" }],
    access: { input_routes: ["keyboard"], output_routes: ["text"], supports },
    preferences: { session_form: "short", evidence_role: "preference_only" },
    hypotheses: [{ skill_id: "skl_foundation", hypothesis_code: "hyp_uncertain", confidence: 0.3, alternative_codes: ["alt_access", "alt_knowledge"], next_observation: "obs_low_risk", observed_at: now, expires_at: "2026-09-04T00:00:00Z" }],
    provenance: "synthetic"
  };
}

test("adult, child/guardian, pre-reader/delegate, and access flows complete from explicit authority", () => {
  const fixtures = [
    [authority(), profile()],
    [authority({ population: "minor", role: "verified_guardian", relationship: "guardian_verified", user: "usr_child", version: "aut_child" }), profile({ user: "usr_child", authorityVersion: "aut_child", age: "child", supports: ["non_audio_equivalent"] })],
    [authority({ population: "pre_reader", role: "caregiver_delegate", relationship: "delegation_verified", route: "caregiver_mediated", user: "usr_early", version: "aut_early" }), profile({ user: "usr_early", authorityVersion: "aut_early", age: "early_childhood", supports: ["large_targets", "short_instructions"] })],
    [authority({ user: "usr_access", version: "aut_access", route: "screen_reader" }), profile({ user: "usr_access", authorityVersion: "aut_access", supports: ["high_contrast", "non_drag_equivalent"] })]
  ];
  for (const [grant, learner] of fixtures) {
    const result = completeOnboarding({ authority: grant, profile: learner, now });
    assert.equal(result.status, "complete");
    assert.equal(result.initialRoute.age_determined_level, false);
    assert.equal(result.initialRoute.diagnostic_required, true);
  }
});

test("unknown, stale, minor-self, unverified caregiver, and inaccessible notice stop or reject", () => {
  assert.equal(completeOnboarding({ authority: authority({ population: "unknown" }), profile: profile(), now }).status, "stopped");
  assert.equal(decideProfileCapability(authority({ expires: "2026-08-03T00:00:00Z" }), { user_ref: "usr_alpha", purpose: "learning_profile", capability: "profile.collect", data_class: "profile_goals" }, { now }).decision, "deny");
  assert.throws(() => validateAuthority(authority({ population: "minor" })), { code: "authority_inference" });
  assert.throws(() => validateAuthority(authority({ population: "pre_reader", role: "caregiver_delegate", relationship: "self_declared", route: "caregiver_mediated" })), { code: "authority_inference" });
  assert.throws(() => validateAuthority(authority({ population: "pre_reader", role: "verified_guardian", relationship: "guardian_verified", route: "semantic_text" })), { code: "inaccessible_notice" });
});

test("private profile histories are isolated, immutable, correctable, and exportable", () => {
  const repository = new ProfileRepository();
  const alphaAuthority = authority();
  const betaAuthority = authority({ user: "usr_beta", version: "aut_beta" });
  repository.registerAuthority(alphaAuthority); repository.registerAuthority(betaAuthority);
  repository.append({ profile: profile(), actorRef: alphaAuthority.actor_ref, now });
  repository.append({ profile: profile({ user: "usr_beta", authorityVersion: "aut_beta" }), actorRef: betaAuthority.actor_ref, now });
  repository.append({ profile: profile({ version: "pro_version2", parent: "pro_version1", supports: ["high_contrast"] }), actorRef: alphaAuthority.actor_ref, now });
  assert.equal(repository.inspect({ userRef: "usr_alpha", actorRef: alphaAuthority.actor_ref, authorityVersion: "aut_version1", now }).length, 2);
  assert.equal(repository.export({ userRef: "usr_alpha", actorRef: alphaAuthority.actor_ref, authorityVersion: "aut_version1", now }).profiles.at(-1).access.supports[0], "high_contrast");
  assert.throws(() => repository.inspect({ userRef: "usr_alpha", actorRef: betaAuthority.actor_ref, authorityVersion: "aut_version1", now }), { code: "cross_user_denied" });
  assert.throws(() => repository.append({ profile: profile({ version: "pro_bad", parent: null }), actorRef: alphaAuthority.actor_ref, now }), { code: "version_conflict" });
});

test("assistants receive only an opaque activity-relevant profile slice", () => {
  const repository = new ProfileRepository(); repository.registerAuthority(authority());
  repository.append({ profile: profile(), actorRef: authority().actor_ref, now });
  const slice = repository.projectForAssistant({ userRef: "usr_alpha", authorityVersion: "aut_version1", now, ephemeralProfileRef: "eph_session1", objectiveId: "out_apply" });
  assert.deepEqual(Object.keys(slice), ["access", "age_band", "ephemeral_profile_ref", "objective_id", "schema", "session_form"]);
  assert.doesNotMatch(JSON.stringify(slice), /usr_alpha|authority|goal|hypothesis/);
});

test("access barriers and model failures never become knowledge errors", () => {
  assert.deepEqual(classifyObservation({ correct: false, access_barrier: true, repeated_independent: true }), { classification: "access_barrier", update_knowledge: false });
  assert.deepEqual(classifyObservation({ correct: false, model_error: true }), { classification: "model_error", update_knowledge: false });
  assert.equal(classifyObservation({ correct: false }).classification, "uncertain_single_observation");
  assert.equal(classifyObservation({ correct: false, repeated_independent: true }).classification, "knowledge_gap_hypothesis");
});

test("diagnosis, identity, fixed learning styles, age stereotypes, and real provenance are rejected", () => {
  for (const mutation of [
    { diagnosis: "private" }, { display_name: "Private" }, { learning_style: "visual" }, { ability_level_inferred_from_age: "low" }, { provenance: "real" }
  ]) assert.throws(() => validateProfile({ ...profile(), ...mutation }), /field|allowed|synthetic/i);
  assert.throws(() => profileToPublicOutput(profile()), { code: "public_profile_forbidden" });
});

test("revocation is append-only and stops affected profile use", () => {
  const active = authority();
  const revoked = revokeAuthority(active, { actorRef: active.actor_ref, at: "2026-08-05T00:00:00Z" });
  assert.equal(revoked.state, "revoked");
  assert.notEqual(revoked.authority_version, active.authority_version);
  const decision = decideProfileCapability(revoked, { user_ref: "usr_alpha", purpose: "learning_profile", capability: "profile.use", data_class: "profile_access" }, { now: "2026-08-05T00:01:00Z" });
  assert.equal(decision.decision, "deny");
  const repository = new ProfileRepository(); repository.registerAuthority(active);
  repository.append({ profile: profile(), actorRef: active.actor_ref, now });
  repository.registerAuthority(revoked);
  assert.throws(() => repository.projectForAssistant({ userRef: "usr_alpha", authorityVersion: active.authority_version, now: "2026-08-05T00:01:00Z", ephemeralProfileRef: "eph_session1", objectiveId: "out_apply" }), { code: "stale_authority" });
});

test("validated profile versions round-trip through the trusted workspace repository", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-profiles-"));
  try {
    const workspace = path.join(base, "workspace"); const local = path.join(base, "local");
    await mkdir(workspace); await mkdir(local);
    await writeFile(path.join(workspace, "workspace.json"), `${JSON.stringify({ schema: "tutor.workspace/v1", workspace_id: "wrk_profiles", format_version: 1 })}\n`);
    const repository = await openWorkspaceRepository({ workspaceRoot: workspace, localStateRoot: local, actor: { userId: "usr_alpha", capabilities: ["profile.read", "profile.write"] } });
    const published = await persistProfileVersion({ workspaceRepository: repository, profile: profile() });
    const restored = await readPersistedProfile({ workspaceRepository: repository, userRef: "usr_alpha", profileVersion: "pro_version1", expectedDigest: published.digest });
    assert.deepEqual(restored, validateProfile(profile()));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
