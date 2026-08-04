import test from "node:test";
import assert from "node:assert/strict";
import {
  ProtocolError,
  checkpointSession,
  createEnvelope,
  createSessionState,
  expireAgentRequests,
  reduceSession
} from "../src/index.js";

function message(direction, sequence, type, payload = {}, options = {}) {
  return createEnvelope({
    sessionId: "session-1",
    sequence,
    messageId: options.messageId ?? `${direction}-${sequence}`,
    causedBy: options.causedBy ?? null,
    sentAt: options.sentAt ?? sequence,
    type,
    payload,
    privacy: options.privacy ?? "ephemeral"
  });
}

function runningSession() {
  let state = createSessionState({ sessionId: "session-1" });
  state = reduceSession(state, message("host", 0, "session.initialize", { objective_id: "generic.sequence" }), { direction: "host" });
  return reduceSession(state, message("assistant", 0, "session.ready", { capabilities: ["attempts"] }), { direction: "assistant" });
}

test("runs a deterministic attempt and adaptation trace", () => {
  let state = runningSession();
  state = reduceSession(state, message("assistant", 1, "attempt.recorded", { correct: false, misconception_code: "order_reversed" }), { direction: "assistant" });
  state = reduceSession(state, message("assistant", 2, "adaptation.requested", { dimension: "scaffold", direction: "increase" }, { messageId: "adapt-1" }), { direction: "assistant" });
  state = reduceSession(state, message("host", 1, "adaptation.applied", { accepted: true, scaffold: "guided" }, { causedBy: "adapt-1" }), { direction: "host" });
  assert.equal(state.attempts.length, 1);
  assert.equal(state.adaptations[0].response.scaffold, "guided");
  assert.equal(state.pendingAdaptations.size, 0);
});

test("rejects duplicate, sequence-gap, foreign-session, and post-stop messages", () => {
  let state = runningSession();
  const attempt = message("assistant", 1, "attempt.recorded", { correct: true });
  state = reduceSession(state, attempt, { direction: "assistant" });
  assert.throws(() => reduceSession(state, attempt, { direction: "assistant" }), (error) => error.code === "duplicate_message");
  assert.throws(() => reduceSession(state, message("assistant", 3, "help.requested"), { direction: "assistant" }), (error) => error.code === "sequence_gap");
  assert.throws(() => reduceSession(state, { ...message("assistant", 2, "help.requested"), session_id: "other" }, { direction: "assistant" }), /another session/);
  state = reduceSession(state, message("host", 1, "session.stop", { reason: "learner" }), { direction: "host" });
  assert.throws(() => reduceSession(state, message("assistant", 2, "help.requested"), { direction: "assistant" }), /after completion or stop/);
});

test("rejects teaching events before ready and invalid pause transitions", () => {
  let state = createSessionState({ sessionId: "session-1" });
  assert.throws(
    () => reduceSession(state, message("assistant", 0, "attempt.recorded", { correct: true }), { direction: "assistant" }),
    (error) => error.code === "session_not_running"
  );
  assert.throws(
    () => reduceSession(state, message("host", 0, "session.pause"), { direction: "host" }),
    (error) => error.code === "invalid_transition"
  );
});

test("agent callbacks require fallback and discard late responses", () => {
  let state = runningSession();
  assert.throws(
    () => reduceSession(state, message("assistant", 1, "agent.requested", { deadline: 50 }), { direction: "assistant" }),
    (error) => error.code === "invalid_agent_request"
  );
  state = reduceSession(state, message("assistant", 1, "agent.requested", { deadline: 50, fallback: { action: "reviewed_item" } }, { messageId: "call-1" }), { direction: "assistant" });
  assert.throws(
    () => reduceSession(state, message("host", 1, "agent.responded", { action: "generated_item" }, { causedBy: "call-1" }), { direction: "host", now: 51 }),
    (error) => error instanceof ProtocolError && error.code === "late_agent_response"
  );
  const expired = expireAgentRequests(state, 51);
  assert.deepEqual(expired.fallbacks, [{ caused_by: "call-1", fallback: { action: "reviewed_item" } }]);
  assert.equal(expired.state.errors[0].code, "agent_timeout");
});

test("checkpoint is serializable and preserves deduplication evidence", () => {
  const state = runningSession();
  const checkpoint = checkpointSession(state);
  assert.deepEqual(checkpoint.lastSequence, { host: 0, assistant: 0 });
  assert.deepEqual(checkpoint.seenMessageIds.sort(), ["assistant-0", "host-0"]);
  assert.doesNotThrow(() => JSON.stringify(checkpoint));
});
