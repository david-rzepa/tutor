import test from "node:test";
import assert from "node:assert/strict";
import { SessionBrokerError, TutorSessionBroker } from "../session-broker.js";

function fixture() {
  let now = 1_000;
  let token = 0;
  let id = 0;
  const broker = new TutorSessionBroker({
    now: () => now,
    makeToken: () => `capability_${++token}_${"x".repeat(20)}`,
    makeId: () => `ses_${String(++id).padStart(32, "0")}`,
    agentLeaseMs: 100
  });
  return { broker, advance: (value) => { now += value; } };
}

test("exchanges ordered in-memory learner and Codex events without an API credential", async () => {
  const { broker } = fixture();
  const session = broker.createSession();
  assert.deepEqual(Object.keys(session).sort(), ["agent_token", "learner_token", "schema", "session_id"]);

  broker.heartbeat({ sessionId: session.session_id, token: session.agent_token });
  const waiting = broker.wait({ sessionId: session.session_id, token: session.agent_token, role: "agent", after: 0, timeoutMs: 500 });
  const learnerEvent = broker.append({
    sessionId: session.session_id, token: session.learner_token, role: "learner",
    messageId: "learner-one", type: "learner.message", payload: { text: "Teach me how to cook" }
  });
  assert.equal(learnerEvent.sequence, 1);
  assert.deepEqual((await waiting).events, [learnerEvent]);

  const tutorEvent = broker.append({
    sessionId: session.session_id, token: session.agent_token, role: "agent",
    messageId: "agent-one", type: "tutor.message", payload: { text: "Let's begin with heat control." }
  });
  assert.equal(tutorEvent.sequence, 2);
  assert.deepEqual(broker.read({ sessionId: session.session_id, token: session.learner_token, role: "learner", after: 1 }).events, [tutorEvent]);
});

test("isolates session capabilities and makes retries idempotent", () => {
  const { broker } = fixture();
  const first = broker.createSession();
  const second = broker.createSession();
  const input = {
    sessionId: first.session_id, token: first.learner_token, role: "learner",
    messageId: "learner-retry", type: "learner.message", payload: { text: "Hello" }
  };
  const event = broker.append(input);
  assert.deepEqual(broker.append(input), event);
  assert.throws(() => broker.append({ ...input, payload: { text: "Changed" } }), { code: "message_collision" });
  assert.throws(() => broker.read({ sessionId: second.session_id, token: first.learner_token, role: "learner" }), { code: "access_denied" });
  assert.throws(() => broker.append({ ...input, token: first.agent_token }), { code: "access_denied" });
});

test("reports an expired Codex heartbeat and fails closed after stop", () => {
  const { broker, advance } = fixture();
  const session = broker.createSession();
  assert.equal(broker.status({ sessionId: session.session_id, token: session.learner_token }).agent_connected, false);
  broker.heartbeat({ sessionId: session.session_id, token: session.agent_token });
  assert.equal(broker.status({ sessionId: session.session_id, token: session.learner_token }).agent_connected, true);
  advance(101);
  assert.equal(broker.status({ sessionId: session.session_id, token: session.learner_token }).agent_connected, false);

  broker.append({ sessionId: session.session_id, token: session.learner_token, role: "learner", messageId: "learner-stop", type: "session.stop", payload: { reason: "learner_choice" } });
  assert.throws(() => broker.append({ sessionId: session.session_id, token: session.agent_token, role: "agent", messageId: "agent-late", type: "tutor.message", payload: { text: "Late" } }), (error) => error instanceof SessionBrokerError && error.code === "session_stopped");
});

test("rejects unbounded or unauthorized browser event content", () => {
  const { broker } = fixture();
  const session = broker.createSession();
  const base = { sessionId: session.session_id, token: session.learner_token, role: "learner", messageId: "learner-bad" };
  assert.throws(() => broker.append({ ...base, type: "tutor.message", payload: { text: "impersonate" } }), { code: "type_denied" });
  assert.throws(() => broker.append({ ...base, type: "learner.message", payload: { text: "x".repeat(4_001) } }), { code: "invalid_message" });
  assert.throws(() => broker.append({ ...base, type: "activity.attempt", payload: { activity_id: "safe_activity", correct: "yes", attempt_count: 1 } }), { code: "invalid_activity_event" });
});
