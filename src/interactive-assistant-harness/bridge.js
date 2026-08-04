import {
  ProtocolError,
  checkpointSession,
  createEnvelope,
  createSessionState,
  expireAgentRequests,
  reduceSession
} from "../../packages/teaching-tools/src/index.js";

export class HostSecurityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HostSecurityError";
    this.code = code;
  }
}

export class HostBridge {
  constructor({ sessionId, expectedSource, expectedOrigin = "null", postMessage, now = () => Date.now(), onStateChange = () => {}, onFallback = () => {} }) {
    if (!expectedSource) throw new TypeError("expectedSource is required");
    if (typeof postMessage !== "function") throw new TypeError("postMessage is required");
    this.expectedSource = expectedSource;
    this.expectedOrigin = expectedOrigin;
    this.postMessage = postMessage;
    this.now = now;
    this.onStateChange = onStateChange;
    this.onFallback = onFallback;
    this.state = createSessionState({ sessionId });
  }

  send(type, payload = {}, { causedBy = null, privacy = "ephemeral" } = {}) {
    const envelope = createEnvelope({
      sessionId: this.state.sessionId,
      sequence: this.state.lastSequence.host + 1,
      messageId: `host-${crypto.randomUUID()}`,
      causedBy,
      sentAt: this.now(),
      type,
      payload,
      privacy
    });
    this.state = reduceSession(this.state, envelope, { direction: "host", now: this.now() });
    this.postMessage(envelope);
    this.onStateChange(this.state, envelope);
    return envelope;
  }

  initialize(configuration) {
    return this.send("session.initialize", configuration, { privacy: "learning_record" });
  }

  receive(event) {
    if (event.source !== this.expectedSource) throw new HostSecurityError("source_rejected", "Message source is not the launched assistant");
    if (event.origin !== this.expectedOrigin) throw new HostSecurityError("origin_rejected", "Message origin does not match the sandbox policy");
    this.state = reduceSession(this.state, event.data, { direction: "assistant", now: this.now() });
    this.onStateChange(this.state, event.data);
    return this.state;
  }

  expireCallbacks() {
    const expired = expireAgentRequests(this.state, this.now());
    this.state = expired.state;
    for (const fallback of expired.fallbacks) this.onFallback(fallback);
    if (expired.fallbacks.length) this.onStateChange(this.state, { type: "host.callbacks_expired", payload: expired.fallbacks });
    return expired.fallbacks;
  }

  checkpoint() {
    return {
      schema: "tutor.host-checkpoint/v1",
      created_at: this.now(),
      session: checkpointSession(this.state)
    };
  }
}

export function restoreSessionFromCheckpoint(checkpoint, { allowedPrivacy = "learning_record" } = {}) {
  if (checkpoint?.schema !== "tutor.host-checkpoint/v1" || !checkpoint.session?.sessionId) {
    throw new ProtocolError("invalid_checkpoint", "Unsupported or incomplete host checkpoint");
  }
  const saved = checkpoint.session;
  if (saved.status === "initializing") throw new ProtocolError("unsafe_checkpoint", "Cannot restore an initialization boundary");
  const state = createSessionState({ sessionId: saved.sessionId, allowedPrivacy });
  state.status = saved.status;
  state.lastSequence = { ...saved.lastSequence };
  state.seenMessageIds = new Set(saved.seenMessageIds);
  state.attempts = [...(saved.attempts ?? [])];
  state.helpEvents = [...(saved.helpEvents ?? [])];
  state.adaptations = [...(saved.adaptations ?? [])];
  state.evidenceSummary = saved.evidenceSummary ?? null;
  state.completion = saved.completion ?? null;
  return state;
}
