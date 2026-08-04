import test from "node:test";
import assert from "node:assert/strict";
import { createEnvelope } from "../../../packages/teaching-tools/src/index.js";
import { HostBridge, HostSecurityError, restoreSessionFromCheckpoint } from "../bridge.js";

function assistantMessage(sessionId, sequence, type, payload = {}, options = {}) {
  return createEnvelope({
    sessionId,
    sequence,
    messageId: options.messageId ?? `assistant-${sequence}`,
    causedBy: options.causedBy ?? null,
    sentAt: options.sentAt ?? sequence,
    type,
    payload,
    privacy: options.privacy ?? "ephemeral"
  });
}

function bridgeFixture() {
  const source = {};
  const sent = [];
  let now = 10;
  const fallbacks = [];
  const bridge = new HostBridge({
    sessionId: "session-1",
    expectedSource: source,
    expectedOrigin: "null",
    postMessage: (message) => sent.push(message),
    now: () => now,
    onFallback: (fallback) => fallbacks.push(fallback)
  });
  return { bridge, source, sent, fallbacks, setNow: (value) => { now = value; } };
}

test("initializes and accepts messages only from the launched opaque-origin frame", () => {
  const fixture = bridgeFixture();
  const init = fixture.bridge.initialize({ objective_id: "generic.classify" });
  assert.equal(fixture.sent[0], init);
  fixture.bridge.receive({
    source: fixture.source,
    origin: "null",
    data: assistantMessage("session-1", 0, "session.ready", { capabilities: [] }, { causedBy: init.message_id })
  });
  assert.equal(fixture.bridge.state.status, "running");
  assert.throws(
    () => fixture.bridge.receive({ source: {}, origin: "null", data: assistantMessage("session-1", 1, "help.requested") }),
    (error) => error instanceof HostSecurityError && error.code === "source_rejected"
  );
  assert.throws(
    () => fixture.bridge.receive({ source: fixture.source, origin: "http://evil.example", data: assistantMessage("session-1", 1, "help.requested") }),
    (error) => error.code === "origin_rejected"
  );
});

test("routes adaptation, pause/resume, stop, and rejects messages after stop", () => {
  const fixture = bridgeFixture();
  const init = fixture.bridge.initialize({ objective_id: "generic.order" });
  fixture.bridge.receive({ source: fixture.source, origin: "null", data: assistantMessage("session-1", 0, "session.ready", {}, { causedBy: init.message_id }) });
  fixture.bridge.receive({ source: fixture.source, origin: "null", data: assistantMessage("session-1", 1, "adaptation.requested", { dimension: "scaffold", direction: "increase" }, { messageId: "adapt-1" }) });
  fixture.bridge.send("adaptation.applied", { scaffold: "guided" }, { causedBy: "adapt-1" });
  fixture.bridge.send("session.pause", { reason: "learner" });
  fixture.bridge.send("session.resume", { reason: "learner" });
  fixture.bridge.send("session.stop", { reason: "learner" });
  assert.equal(fixture.bridge.state.status, "stopped");
  assert.equal(fixture.bridge.state.adaptations.length, 1);
  assert.throws(() => fixture.bridge.receive({ source: fixture.source, origin: "null", data: assistantMessage("session-1", 2, "help.requested") }), /after completion or stop/);
});

test("expires callbacks into deterministic fallbacks and checkpoints safely", () => {
  const fixture = bridgeFixture();
  const init = fixture.bridge.initialize({ objective_id: "generic.predict" });
  fixture.bridge.receive({ source: fixture.source, origin: "null", data: assistantMessage("session-1", 0, "session.ready", {}, { causedBy: init.message_id }) });
  fixture.bridge.receive({
    source: fixture.source,
    origin: "null",
    data: assistantMessage("session-1", 1, "agent.requested", { deadline: 20, fallback: { action: "reviewed_prompt" } }, { messageId: "call-1" })
  });
  fixture.setNow(21);
  assert.deepEqual(fixture.bridge.expireCallbacks(), [{ caused_by: "call-1", fallback: { action: "reviewed_prompt" } }]);
  const restored = restoreSessionFromCheckpoint(fixture.bridge.checkpoint());
  assert.equal(restored.status, "running");
  assert.equal(restored.seenMessageIds.has("call-1"), true);
  assert.equal(restored.errors.length, 0, "diagnostic errors are deliberately not durable learner evidence");
});
