import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const SESSION_ID = /^ses_[a-f0-9]{32}$/;
const MESSAGE_ID = /^[a-z][a-z0-9_.:-]{2,127}$/;
const ACTIVITY_ID = /^[a-z][a-z0-9_-]{2,79}$/;
const ALLOWED_TYPES = {
  learner: new Set(["learner.message", "activity.attempt", "activity.help", "session.stop"]),
  agent: new Set(["tutor.message", "tutor.status", "activity.inline", "session.complete"])
};

export class SessionBrokerError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "SessionBrokerError";
    this.code = code;
    this.status = status;
  }
}

const digest = (value) => createHash("sha256").update(value).digest();
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const canonical = (value) => JSON.stringify(stable(value));

function safeEqual(actual, expectedDigest) {
  if (typeof actual !== "string" || actual.length < 16 || actual.length > 256) return false;
  const actualDigest = digest(actual);
  return timingSafeEqual(actualDigest, expectedDigest);
}

function validatePayload(type, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SessionBrokerError("invalid_payload", "Event payload must be an object");
  }
  let encoded;
  try { encoded = canonical(payload); }
  catch { throw new SessionBrokerError("invalid_payload", "Event payload must be serializable"); }
  if (new TextEncoder().encode(encoded).byteLength > 16_384) {
    throw new SessionBrokerError("payload_too_large", "Event payload exceeds the session limit", 413);
  }
  if (["learner.message", "tutor.message"].includes(type)) {
    if (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 4_000) {
      throw new SessionBrokerError("invalid_message", "Chat text must be between 1 and 4000 characters");
    }
  }
  if (type === "tutor.message" && payload.sources !== undefined) {
    if (!Array.isArray(payload.sources) || payload.sources.length < 1 || payload.sources.length > 8) {
      throw new SessionBrokerError("invalid_sources", "Optional tutor sources must contain 1 to 8 entries");
    }
    for (const source of payload.sources) {
      if (!source || typeof source !== "object" || Array.isArray(source) || Object.keys(source).some((key) => !["title", "url"].includes(key)) || typeof source.title !== "string" || !source.title.trim() || source.title.length > 160 || typeof source.url !== "string" || source.url.length > 2_048) {
        throw new SessionBrokerError("invalid_sources", "Each tutor source requires a bounded title and HTTPS URL");
      }
      let parsed;
      try { parsed = new URL(source.url); }
      catch { throw new SessionBrokerError("invalid_sources", "Each tutor source requires a bounded title and HTTPS URL"); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new SessionBrokerError("invalid_sources", "Each tutor source requires a bounded title and HTTPS URL");
      }
    }
  }
  if (type === "activity.inline" && !ACTIVITY_ID.test(payload.activity_id ?? "")) {
    throw new SessionBrokerError("invalid_activity", "Inline activity requires a safe activity ID");
  }
  if (type === "activity.inline" && (typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 160)) {
    throw new SessionBrokerError("invalid_activity", "Inline activity requires a bounded learner-facing label");
  }
  if (type === "activity.attempt" && (!ACTIVITY_ID.test(payload.activity_id ?? "") || typeof payload.correct !== "boolean" || !Number.isInteger(payload.attempt_count) || payload.attempt_count < 1 || payload.attempt_count > 8)) {
    throw new SessionBrokerError("invalid_activity_event", "Activity attempt summary is invalid");
  }
  if (type === "activity.help" && !ACTIVITY_ID.test(payload.activity_id ?? "")) {
    throw new SessionBrokerError("invalid_activity_event", "Activity help summary is invalid");
  }
  if (["tutor.status", "session.complete"].includes(type) && (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 240)) {
    throw new SessionBrokerError("invalid_status", "Status text must be bounded");
  }
  if (type === "session.stop" && (typeof payload.reason !== "string" || !MESSAGE_ID.test(payload.reason))) {
    throw new SessionBrokerError("invalid_stop", "Stop reason must be a bounded reason code");
  }
  return stable(payload);
}

export class TutorSessionBroker {
  #sessions = new Map();

  constructor({ now = () => Date.now(), makeToken = () => randomBytes(32).toString("base64url"), makeId = () => `ses_${randomUUID().replaceAll("-", "")}`, agentLeaseMs = 15_000, maxEvents = 200, maxSessions = 8 } = {}) {
    this.now = now;
    this.makeToken = makeToken;
    this.makeId = makeId;
    this.agentLeaseMs = agentLeaseMs;
    this.maxEvents = maxEvents;
    this.maxSessions = maxSessions;
  }

  createSession() {
    if (this.#sessions.size >= this.maxSessions) throw new SessionBrokerError("session_capacity", "Session capacity reached", 409);
    const sessionId = this.makeId();
    if (!SESSION_ID.test(sessionId) || this.#sessions.has(sessionId)) throw new SessionBrokerError("invalid_session_id", "Could not allocate a safe session ID", 500);
    const learnerToken = this.makeToken();
    const agentToken = this.makeToken();
    if (learnerToken === agentToken) throw new SessionBrokerError("token_collision", "Could not allocate isolated session tokens", 500);
    this.#sessions.set(sessionId, {
      learnerDigest: digest(learnerToken), agentDigest: digest(agentToken), events: [], messages: new Map(),
      createdAt: this.now(), agentSeenAt: null, stopped: false, waiters: new Set()
    });
    return { schema: "tutor.browser-session/v1", session_id: sessionId, learner_token: learnerToken, agent_token: agentToken };
  }

  #session(sessionId) {
    if (!SESSION_ID.test(sessionId ?? "")) throw new SessionBrokerError("unknown_session", "Session is unavailable", 404);
    const session = this.#sessions.get(sessionId);
    if (!session) throw new SessionBrokerError("unknown_session", "Session is unavailable", 404);
    return session;
  }

  #authorize(session, token, role) {
    const expected = role === "agent" ? session.agentDigest : role === "learner" ? session.learnerDigest : null;
    if (!expected || !safeEqual(token, expected)) throw new SessionBrokerError("access_denied", "Session capability was rejected", 403);
  }

  heartbeat({ sessionId, token }) {
    const session = this.#session(sessionId);
    this.#authorize(session, token, "agent");
    session.agentSeenAt = this.now();
    return { schema: "tutor.browser-session-status/v1", session_id: sessionId, agent_connected: true };
  }

  status({ sessionId, token }) {
    const session = this.#session(sessionId);
    this.#authorize(session, token, "learner");
    return {
      schema: "tutor.browser-session-status/v1", session_id: sessionId,
      agent_connected: session.agentSeenAt !== null && this.now() - session.agentSeenAt <= this.agentLeaseMs,
      stopped: session.stopped, last_sequence: session.events.at(-1)?.sequence ?? 0
    };
  }

  append({ sessionId, token, role, messageId, type, payload }) {
    const session = this.#session(sessionId);
    this.#authorize(session, token, role);
    if (!MESSAGE_ID.test(messageId ?? "")) throw new SessionBrokerError("invalid_message_id", "A safe message ID is required");
    if (!ALLOWED_TYPES[role]?.has(type)) throw new SessionBrokerError("type_denied", "Event type is not allowed for this capability", 403);
    if (session.stopped && type !== "session.stop") throw new SessionBrokerError("session_stopped", "Session has ended", 409);
    if (type === "activity.inline" && !session.events.some((event) => event.type === "learner.message")) {
      throw new SessionBrokerError("learner_turn_required", "The learner must answer the opening prompt before an activity is shown", 409);
    }
    const cleanPayload = validatePayload(type, payload);
    const fingerprint = canonical({ role, type, payload: cleanPayload });
    const prior = session.messages.get(messageId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new SessionBrokerError("message_collision", "Message ID was reused with different content", 409);
      return structuredClone(prior.event);
    }
    if (session.events.length >= this.maxEvents) throw new SessionBrokerError("session_full", "Session event limit reached", 409);
    const event = stable({
      schema: "tutor.browser-event/v1", session_id: sessionId,
      sequence: session.events.length + 1, message_id: messageId, sender: role, type,
      payload: cleanPayload, sent_at: this.now()
    });
    session.events.push(event);
    session.messages.set(messageId, { fingerprint, event });
    if (type === "session.stop" || type === "session.complete") session.stopped = true;
    for (const wake of session.waiters) wake();
    return structuredClone(event);
  }

  read({ sessionId, token, role, after = 0 }) {
    const session = this.#session(sessionId);
    this.#authorize(session, token, role);
    if (!Number.isSafeInteger(after) || after < 0) throw new SessionBrokerError("invalid_cursor", "Event cursor must be a non-negative integer");
    if (role === "agent") session.agentSeenAt = this.now();
    return {
      schema: "tutor.browser-events/v1", session_id: sessionId,
      events: session.events.filter((event) => event.sequence > after).map((event) => structuredClone(event)),
      stopped: session.stopped
    };
  }

  async wait({ sessionId, token, role, after = 0, timeoutMs = 25_000 }) {
    const first = this.read({ sessionId, token, role, after });
    if (first.events.length || first.stopped || timeoutMs <= 0) return first;
    const session = this.#session(sessionId);
    const boundedTimeout = Math.min(Math.max(timeoutMs, 1), 30_000);
    await new Promise((resolve) => {
      let timer;
      const wake = () => { clearTimeout(timer); session.waiters.delete(wake); resolve(); };
      session.waiters.add(wake);
      timer = setTimeout(wake, boundedTimeout);
    });
    return this.read({ sessionId, token, role, after });
  }
}
