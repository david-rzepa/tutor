import { ProtocolError, validateEnvelope } from "./protocol.js";

const TERMINAL = new Set(["completed", "stopped"]);
const ACTIVE_MESSAGES = new Set([
  "attempt.recorded",
  "help.requested",
  "adaptation.requested",
  "adaptation.applied",
  "agent.requested",
  "agent.responded",
  "evidence.summarized",
  "session.complete"
]);

export function createSessionState({ sessionId, allowedPrivacy = "learning_record", allowedTypes } = {}) {
  if (!sessionId) throw new TypeError("sessionId is required");
  return {
    sessionId,
    status: "created",
    allowedPrivacy,
    allowedTypes: allowedTypes ? new Set(allowedTypes) : undefined,
    lastSequence: { host: -1, assistant: -1 },
    seenMessageIds: new Set(),
    attempts: [],
    helpEvents: [],
    adaptations: [],
    pendingAdaptations: new Map(),
    pendingAgentRequests: new Map(),
    errors: [],
    evidenceSummary: null,
    completion: null
  };
}

function cloneState(state) {
  return {
    ...state,
    lastSequence: { ...state.lastSequence },
    seenMessageIds: new Set(state.seenMessageIds),
    attempts: [...state.attempts],
    helpEvents: [...state.helpEvents],
    adaptations: [...state.adaptations],
    pendingAdaptations: new Map(state.pendingAdaptations),
    pendingAgentRequests: new Map(state.pendingAgentRequests),
    errors: [...state.errors]
  };
}

function requireCause(map, envelope, code) {
  if (!envelope.caused_by || !map.has(envelope.caused_by)) {
    throw new ProtocolError(code, `${envelope.type} must reference a pending request`);
  }
}

export function reduceSession(state, envelope, { direction, now = Date.now() } = {}) {
  if (direction !== "host" && direction !== "assistant") throw new TypeError("direction must be host or assistant");
  const message = validateEnvelope(envelope, {
    direction,
    allowedPrivacy: state.allowedPrivacy,
    allowedTypes: state.allowedTypes
  });
  if (message.session_id !== state.sessionId) throw new ProtocolError("session_mismatch", "Message belongs to another session");
  if (state.seenMessageIds.has(message.message_id)) throw new ProtocolError("duplicate_message", "message_id has already been applied");
  if (message.sequence !== state.lastSequence[direction] + 1) throw new ProtocolError("sequence_gap", `Expected ${direction} sequence ${state.lastSequence[direction] + 1}`);
  if (TERMINAL.has(state.status)) throw new ProtocolError("session_terminal", "No messages are accepted after completion or stop");
  if (ACTIVE_MESSAGES.has(message.type) && state.status !== "running") {
    throw new ProtocolError("session_not_running", `${message.type} requires a running session`);
  }

  const next = cloneState(state);
  next.seenMessageIds.add(message.message_id);
  next.lastSequence[direction] = message.sequence;

  switch (message.type) {
    case "session.initialize":
      if (state.status !== "created") throw new ProtocolError("invalid_transition", "Session already initialized");
      next.status = "initializing";
      next.configuration = message.payload;
      break;
    case "session.ready":
      if (state.status !== "initializing") throw new ProtocolError("invalid_transition", "Ready requires initialization");
      next.status = "running";
      next.capabilities = message.payload;
      break;
    case "session.pause":
      if (state.status !== "running") throw new ProtocolError("invalid_transition", "Pause requires a running session");
      next.status = "paused";
      break;
    case "session.resume":
      if (state.status !== "paused") throw new ProtocolError("invalid_transition", "Resume requires a paused session");
      next.status = "running";
      break;
    case "session.complete":
      next.status = "completed";
      next.completion = message.payload;
      break;
    case "session.stop":
      next.status = "stopped";
      next.completion = message.payload;
      next.pendingAgentRequests.clear();
      next.pendingAdaptations.clear();
      break;
    case "attempt.recorded":
      next.attempts.push({ ...message.payload, message_id: message.message_id });
      break;
    case "help.requested":
      next.helpEvents.push({ ...message.payload, message_id: message.message_id });
      break;
    case "adaptation.requested":
      next.pendingAdaptations.set(message.message_id, message.payload);
      break;
    case "adaptation.applied":
      requireCause(state.pendingAdaptations, message, "unknown_adaptation");
      next.adaptations.push({ request: state.pendingAdaptations.get(message.caused_by), response: message.payload });
      next.pendingAdaptations.delete(message.caused_by);
      break;
    case "agent.requested":
      if (!Number.isFinite(message.payload.deadline) || !("fallback" in message.payload)) {
        throw new ProtocolError("invalid_agent_request", "Agent request requires a numeric deadline and deterministic fallback");
      }
      next.pendingAgentRequests.set(message.message_id, message.payload);
      break;
    case "agent.responded": {
      requireCause(state.pendingAgentRequests, message, "unknown_agent_request");
      const request = state.pendingAgentRequests.get(message.caused_by);
      if (now > request.deadline) throw new ProtocolError("late_agent_response", "Late agent response must be discarded");
      next.pendingAgentRequests.delete(message.caused_by);
      next.lastAgentResponse = message.payload;
      break;
    }
    case "evidence.summarized":
      next.evidenceSummary = message.payload;
      break;
    case "error.reported":
      next.errors.push(message.payload);
      break;
    default:
      throw new ProtocolError("unhandled_message", `No reducer for ${message.type}`);
  }
  return next;
}

export function expireAgentRequests(state, now = Date.now()) {
  const next = cloneState(state);
  const fallbacks = [];
  for (const [messageId, request] of state.pendingAgentRequests) {
    if (now > request.deadline) {
      fallbacks.push({ caused_by: messageId, fallback: request.fallback });
      next.pendingAgentRequests.delete(messageId);
      next.errors.push({ code: "agent_timeout", caused_by: messageId, recoverable: true });
    }
  }
  return { state: next, fallbacks };
}

export function checkpointSession(state) {
  return {
    sessionId: state.sessionId,
    status: state.status,
    lastSequence: { ...state.lastSequence },
    seenMessageIds: [...state.seenMessageIds],
    attempts: state.attempts,
    helpEvents: state.helpEvents,
    adaptations: state.adaptations,
    evidenceSummary: state.evidenceSummary,
    completion: state.completion
  };
}
