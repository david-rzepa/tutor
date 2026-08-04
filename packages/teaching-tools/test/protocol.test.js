import test from "node:test";
import assert from "node:assert/strict";
import {
  PROTOCOL,
  ProtocolError,
  createEnvelope,
  validateEnvelope
} from "../src/index.js";

const base = (overrides = {}) => createEnvelope({
  sessionId: "session-1",
  sequence: 0,
  messageId: "message-1",
  sentAt: 0,
  type: "session.initialize",
  payload: { objective_id: "generic.classify", age_band: "child" },
  ...overrides
});

test("accepts a minimal generic initialization envelope", () => {
  const result = validateEnvelope(base(), { direction: "host", allowedPrivacy: "learning_record" });
  assert.equal(result.protocol, PROTOCOL);
  assert.equal(result.payload.objective_id, "generic.classify");
});

test("rejects protocol, direction, capability, and privacy violations", () => {
  assert.throws(() => validateEnvelope({ ...base(), protocol: "tutor.assistant/v2" }, { direction: "host" }), /Expected tutor\.assistant\/v1/);
  assert.throws(() => validateEnvelope(base({ type: "attempt.recorded" }), { direction: "host" }), /not allowed/);
  assert.throws(() => validateEnvelope(base(), { direction: "host", allowedTypes: new Set(["session.stop"]) }), /not granted/);
  assert.throws(() => validateEnvelope(base({ privacy: "sensitive" }), { direction: "host", allowedPrivacy: "learning_record" }), /privacy grant/);
});

test("rejects identity, diagnosis, and transcript fields in initialization", () => {
  for (const key of ["name", "diagnosis", "raw_transcript"]) {
    assert.throws(
      () => validateEnvelope(base({ payload: { objective_id: "generic", nested: { [key]: "forbidden" } } }), { direction: "host" }),
      (error) => error instanceof ProtocolError && error.code === "profile_data_forbidden"
    );
  }
});

test("rejects oversized payloads and unknown fields", () => {
  assert.throws(() => validateEnvelope(base({ payload: { content: "x".repeat(100) } }), { direction: "host", maxPayloadBytes: 10 }), /configured limit/);
  assert.throws(() => validateEnvelope({ ...base(), unexpected: true }, { direction: "host" }), /Unknown envelope fields/);
});
