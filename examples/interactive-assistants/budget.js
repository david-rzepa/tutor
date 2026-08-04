export const ACTIVITY_BUDGET = Object.freeze({
  maxConfigBytes: 8 * 1024,
  maxGeneratedAppBytes: 24 * 1024,
  maxGeneratedFiles: 4,
  maxSingleFileBytes: 12 * 1024,
  maxItems: 8,
  maxUiStates: 4,
  maxAgentCallbacks: 1,
  targetBuildMilliseconds: 500
});

export const MECHANICS = new Set(["choice", "sequence", "recall"]);
export const LEARNER_PERSONAS = new Set(["age-11", "adult", "caregiver-mediated"]);
const TOP_LEVEL_FIELDS = new Set([
  "schema", "activity_id", "objective", "mechanic", "prompt", "items", "answer",
  "feedback", "scaffold", "presentation", "limits", "curriculum_ref"
]);
const FORBIDDEN_CONFIG_KEYS = new Set(["html", "script", "image", "audio", "video", "iframe", "url", "src", "dependency", "package"]);
const FORBIDDEN_PROFILE_KEYS = new Set(["name", "email", "phone", "address", "date_of_birth", "birthdate", "diagnosis", "raw_transcript", "transcript"]);
const GENERATED_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);
const FORBIDDEN_CODE = [
  /\bfetch\s*\(/, /\bWebSocket\b/, /XMLHttpRequest/, /navigator\.(mediaDevices|geolocation|clipboard)/,
  /localStorage|sessionStorage|indexedDB/, /\beval\s*\(/, /new\s+Function\b/, /document\.cookie/,
  /https?:\/\//, /<script[^>]+src=["']https?:/i
];

export class ActivityValidationError extends Error {
  constructor(errors) {
    super(`Activity failed validation: ${errors.join("; ")}`);
    this.name = "ActivityValidationError";
    this.errors = errors;
  }
}

const bytes = (value) => new TextEncoder().encode(value).byteLength;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const safeId = (value) => typeof value === "string" && /^[a-z][a-z0-9_-]{2,79}$/.test(value);

function scanForbiddenKeys(value, path = "config", errors = []) {
  if (Array.isArray(value)) value.forEach((child, index) => scanForbiddenKeys(child, `${path}[${index}]`, errors));
  else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_CONFIG_KEYS.has(key.toLowerCase())) errors.push(`${path}.${key} is not allowed in configuration`);
      scanForbiddenKeys(child, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function containsForbiddenProfileKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenProfileKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_PROFILE_KEYS.has(key.toLowerCase()) || containsForbiddenProfileKey(child));
}

export function validateActivityConfig(config) {
  const errors = [];
  if (!isRecord(config)) throw new ActivityValidationError(["configuration must be an object"]);
  const encoded = JSON.stringify(config);
  if (bytes(encoded) > ACTIVITY_BUDGET.maxConfigBytes) errors.push("configuration exceeds byte budget");
  const unknown = Object.keys(config).filter((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unknown.length) errors.push(`unknown fields: ${unknown.join(", ")}`);
  if (config.schema !== "tutor.activity-card/v1") errors.push("unsupported schema");
  if (!safeId(config.activity_id)) errors.push("activity_id is unsafe");
  if (!isRecord(config.objective) || !safeId(config.objective.id) || typeof config.objective.label !== "string" || !config.objective.label.trim() || config.objective.label.length > 120) errors.push("objective requires a safe ID and bounded label");
  if (!MECHANICS.has(config.mechanic)) errors.push("mechanic must be choice, sequence, or recall");
  if (typeof config.prompt !== "string" || !config.prompt.trim() || config.prompt.length > 240) errors.push("prompt is missing or too long");
  if (!Array.isArray(config.items) || config.items.length < 2 || config.items.length > ACTIVITY_BUDGET.maxItems) errors.push("items must contain 2–8 entries");
  else {
    if (config.items.some((item) => !isRecord(item) || !safeId(item.id) || typeof item.label !== "string" || !item.label.trim() || item.label.length > 120)) errors.push("every item needs a safe ID and bounded label");
    if (new Set(config.items.map((item) => item?.id)).size !== config.items.length) errors.push("item IDs must be unique");
  }
  const itemIds = new Set(config.items?.map((item) => item?.id));
  if (config.mechanic === "sequence" && (!Array.isArray(config.answer) || config.answer.length !== config.items?.length || new Set(config.answer).size !== config.answer.length || config.answer.some((id) => !itemIds.has(id)))) errors.push("sequence answer must include every item ID exactly once");
  if (config.mechanic === "choice" && (typeof config.answer !== "string" || !itemIds.has(config.answer))) errors.push("choice answer must reference one item ID");
  if (config.mechanic === "recall" && (!Array.isArray(config.answer) || !config.answer.length || config.answer.length > ACTIVITY_BUDGET.maxItems || config.answer.some((answer) => typeof answer !== "string" || !answer.trim() || answer.length > 120))) errors.push("recall answer must be a bounded non-empty string list");
  if (!isRecord(config.feedback) || [config.feedback?.correct, config.feedback?.retry].some((text) => typeof text !== "string" || !text.trim() || text.length > 240)) errors.push("bounded correct/retry feedback is required");
  if (!isRecord(config.scaffold) || typeof config.scaffold.hint !== "string" || !config.scaffold.hint.trim() || config.scaffold.hint.length > 240 || !Number.isInteger(config.scaffold.after_errors) || config.scaffold.after_errors < 1 || config.scaffold.after_errors > 3) errors.push("scaffold requires a bounded hint and after_errors from 1–3");
  if (!isRecord(config.presentation) || !LEARNER_PERSONAS.has(config.presentation.learner_persona)) errors.push("presentation requires a supported learner_persona");
  if (!isRecord(config.limits) || !Number.isInteger(config.limits.max_attempts) || config.limits.max_attempts < 1 || config.limits.max_attempts > 8) errors.push("max_attempts must be 1–8");
  if (config.limits?.max_agent_callbacks > ACTIVITY_BUDGET.maxAgentCallbacks) errors.push("agent callback budget exceeded");
  if (config.limits?.ui_states > ACTIVITY_BUDGET.maxUiStates) errors.push("UI state budget exceeded");
  scanForbiddenKeys(config, "config", errors);
  if (errors.length) throw new ActivityValidationError(errors);
  return Object.freeze(structuredClone(config));
}

export function validateGeneratedApp({ manifest, files }) {
  const errors = [];
  if (!isRecord(manifest) || manifest.schema !== "tutor.generated-activity/v1") errors.push("unsupported generated-app manifest");
  if (!safeId(manifest?.activity_id)) errors.push("activity_id is unsafe");
  if (!isRecord(manifest?.objective) || !safeId(manifest?.objective?.id)) errors.push("objective requires a safe ID");
  if (!isRecord(manifest?.presentation) || !LEARNER_PERSONAS.has(manifest.presentation.learner_persona)) errors.push("presentation requires a supported learner_persona");
  if (!isRecord(manifest?.session_config) || bytes(JSON.stringify(manifest.session_config ?? {})) > ACTIVITY_BUDGET.maxConfigBytes) errors.push("session configuration is missing or over budget");
  if (containsForbiddenProfileKey(manifest?.session_config)) errors.push("session configuration contains private profile or transcript data");
  if (!isRecord(manifest?.limits) || manifest.limits.ui_states > ACTIVITY_BUDGET.maxUiStates || manifest.limits.max_agent_callbacks > ACTIVITY_BUDGET.maxAgentCallbacks) errors.push("generated app exceeds state/callback budget");
  if (!Array.isArray(files) || files.length < 2 || files.length > ACTIVITY_BUDGET.maxGeneratedFiles) errors.push("generated app file count is outside budget");
  let total = 0;
  const paths = new Set();
  for (const file of files ?? []) {
    if (!isRecord(file) || typeof file.path !== "string" || typeof file.content !== "string") { errors.push("generated file is invalid"); continue; }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(file.path) || !GENERATED_EXTENSIONS.has(file.path.slice(file.path.lastIndexOf(".")))) errors.push(`unsafe generated path: ${file.path}`);
    if (paths.has(file.path)) errors.push(`duplicate generated path: ${file.path}`);
    paths.add(file.path);
    const size = bytes(file.content); total += size;
    if (size > ACTIVITY_BUDGET.maxSingleFileBytes) errors.push(`${file.path} exceeds single-file budget`);
    for (const pattern of FORBIDDEN_CODE) if (pattern.test(file.content)) errors.push(`${file.path} requests a forbidden capability`);
  }
  if (total > ACTIVITY_BUDGET.maxGeneratedAppBytes) errors.push("generated app exceeds total byte budget");
  if (!paths.has(manifest?.entry)) errors.push("generated app entry is missing");
  if (!files?.some((file) => file.path.endsWith(".js") && file.content.includes("tutor.assistant/v1"))) errors.push("generated app does not declare the assistant protocol");
  const html = files?.find((file) => file.path === manifest?.entry)?.content ?? "";
  if (!/<html[^>]+lang=/i.test(html) || !/<main[\s>]/i.test(html) || /<script(?![^>]+src=)/i.test(html)) errors.push("entry must have lang, main, and external scripts only");
  if (errors.length) throw new ActivityValidationError(errors);
  return { manifest: Object.freeze(structuredClone(manifest)), totalBytes: total, fileCount: files.length };
}
