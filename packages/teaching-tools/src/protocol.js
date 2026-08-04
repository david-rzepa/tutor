export const PROTOCOL = "tutor.assistant/v1";
export const SCHEMA_VERSION = 1;
export const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;

export const HOST_MESSAGE_TYPES = new Set([
  "session.initialize",
  "session.pause",
  "session.resume",
  "session.stop",
  "adaptation.applied",
  "agent.responded",
  "error.reported"
]);

export const ASSISTANT_MESSAGE_TYPES = new Set([
  "session.ready",
  "session.pause",
  "session.resume",
  "session.complete",
  "session.stop",
  "attempt.recorded",
  "help.requested",
  "adaptation.requested",
  "agent.requested",
  "evidence.summarized",
  "error.reported"
]);

export const PRIVACY_LEVELS = Object.freeze({
  ephemeral: 0,
  learning_record: 1,
  sensitive: 2
});

const ENVELOPE_FIELDS = new Set([
  "protocol",
  "session_id",
  "sequence",
  "message_id",
  "caused_by",
  "sent_at",
  "type",
  "payload",
  "privacy",
  "schema_version"
]);

const FORBIDDEN_PROFILE_KEYS = new Set([
  "name",
  "email",
  "phone",
  "address",
  "date_of_birth",
  "birthdate",
  "diagnosis",
  "raw_transcript",
  "transcript"
]);

export class ProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}

function assert(condition, code, message) {
  if (!condition) throw new ProtocolError(code, message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsForbiddenProfileKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenProfileKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_PROFILE_KEYS.has(key.toLowerCase()) || containsForbiddenProfileKey(child)
  );
}

export function validateEnvelope(envelope, options = {}) {
  const {
    direction,
    allowedPrivacy = "sensitive",
    allowedTypes,
    maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES
  } = options;

  assert(isRecord(envelope), "invalid_envelope", "Envelope must be an object");
  const unknown = Object.keys(envelope).filter((key) => !ENVELOPE_FIELDS.has(key));
  assert(unknown.length === 0, "unknown_field", `Unknown envelope fields: ${unknown.join(", ")}`);
  assert(envelope.protocol === PROTOCOL, "protocol_mismatch", `Expected ${PROTOCOL}`);
  assert(envelope.schema_version === SCHEMA_VERSION, "schema_mismatch", "Unsupported schema version");
  assert(typeof envelope.session_id === "string" && envelope.session_id.length > 0, "invalid_session", "session_id is required");
  assert(Number.isSafeInteger(envelope.sequence) && envelope.sequence >= 0, "invalid_sequence", "sequence must be a non-negative integer");
  assert(typeof envelope.message_id === "string" && envelope.message_id.length > 0, "invalid_message_id", "message_id is required");
  assert(envelope.caused_by === null || (typeof envelope.caused_by === "string" && envelope.caused_by.length > 0), "invalid_cause", "caused_by must be null or an ID");
  assert(typeof envelope.sent_at === "string" || Number.isFinite(envelope.sent_at), "invalid_time", "sent_at must be an ISO string or finite monotonic time");
  assert(isRecord(envelope.payload), "invalid_payload", "payload must be an object");
  assert(Object.hasOwn(PRIVACY_LEVELS, envelope.privacy), "invalid_privacy", "Unknown privacy class");
  assert(Object.hasOwn(PRIVACY_LEVELS, allowedPrivacy), "invalid_privacy_grant", "Unknown privacy grant");
  assert(PRIVACY_LEVELS[envelope.privacy] <= PRIVACY_LEVELS[allowedPrivacy], "privacy_exceeded", "Message exceeds the session privacy grant");
  assert(new TextEncoder().encode(JSON.stringify(envelope.payload)).byteLength <= maxPayloadBytes, "payload_too_large", "Payload exceeds the configured limit");

  const directional = direction === "host" ? HOST_MESSAGE_TYPES : direction === "assistant" ? ASSISTANT_MESSAGE_TYPES : new Set([...HOST_MESSAGE_TYPES, ...ASSISTANT_MESSAGE_TYPES]);
  assert(directional.has(envelope.type), "direction_violation", `${envelope.type} is not allowed from ${direction ?? "either direction"}`);
  if (allowedTypes) assert(allowedTypes.has(envelope.type), "capability_denied", `${envelope.type} was not granted`);
  if (envelope.type === "session.initialize") {
    assert(!containsForbiddenProfileKey(envelope.payload), "profile_data_forbidden", "Initialization contains identity, diagnosis, or transcript data");
  }
  return Object.freeze({ ...envelope, payload: Object.freeze({ ...envelope.payload }) });
}

export function createEnvelope({ sessionId, sequence, messageId, causedBy = null, sentAt, type, payload = {}, privacy = "ephemeral" }) {
  return {
    protocol: PROTOCOL,
    session_id: sessionId,
    sequence,
    message_id: messageId,
    caused_by: causedBy,
    sent_at: sentAt,
    type,
    payload,
    privacy,
    schema_version: SCHEMA_VERSION
  };
}
