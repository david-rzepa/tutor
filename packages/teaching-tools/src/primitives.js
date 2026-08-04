const SCAFFOLD_ORDER = Object.freeze(["model", "guided", "cued", "none"]);

export function createSeededRuntime(seed = 1, startTime = 0) {
  let value = seed >>> 0;
  let counter = 0;
  return Object.freeze({
    nextId(prefix = "msg") {
      value = (1664525 * value + 1013904223) >>> 0;
      counter += 1;
      return `${prefix}-${counter}-${value.toString(16)}`;
    },
    now() {
      return startTime + counter;
    }
  });
}

export function createHintLadder(levels) {
  if (!Array.isArray(levels) || levels.length === 0) throw new TypeError("A hint ladder requires at least one level");
  return Object.freeze(levels.map((level, index) => Object.freeze({ index, ...level })));
}

export function nextHint(ladder, priorHelpCount) {
  return ladder[Math.min(priorHelpCount, ladder.length - 1)];
}

export function recommendScaffold(attempts, { current = "cued", errorThreshold = 3, successThreshold = 2 } = {}) {
  const index = SCAFFOLD_ORDER.indexOf(current);
  if (index < 0) throw new TypeError(`Unknown scaffold: ${current}`);
  const recent = attempts.slice(-Math.max(errorThreshold, successThreshold));
  const errors = recent.slice(-errorThreshold).filter((attempt) => !attempt.correct).length;
  const successes = recent.slice(-successThreshold).filter((attempt) => attempt.correct && !attempt.help_used).length;
  if (recent.length >= errorThreshold && errors === errorThreshold && index > 0) {
    return { action: "increase", scaffold: SCAFFOLD_ORDER[index - 1], reason: "sustained_target_errors" };
  }
  if (recent.length >= successThreshold && successes === successThreshold && index < SCAFFOLD_ORDER.length - 1) {
    return { action: "fade", scaffold: SCAFFOLD_ORDER[index + 1], reason: "consecutive_unaided_success" };
  }
  return { action: "hold", scaffold: current, reason: "insufficient_evidence" };
}

export function summarizeEvidence({ objectiveId, assistantId, assistantVersion, attempts, adaptations = [], stopReason }) {
  const correctByScaffold = {};
  const misconceptionCodes = new Set();
  let unaidedAttempts = 0;
  for (const attempt of attempts) {
    const scaffold = attempt.scaffold ?? "unknown";
    if (attempt.correct) correctByScaffold[scaffold] = (correctByScaffold[scaffold] ?? 0) + 1;
    if (scaffold === "none") unaidedAttempts += 1;
    if (attempt.misconception_code) misconceptionCodes.add(attempt.misconception_code);
  }
  return {
    objective_id: objectiveId,
    assistant_id: assistantId,
    assistant_version: assistantVersion,
    attempts: attempts.length,
    unaided_attempts: unaidedAttempts,
    correct_by_scaffold: correctByScaffold,
    misconception_codes: [...misconceptionCodes].sort(),
    adaptations: adaptations.map(({ dimension, direction }) => `${dimension}:${direction}`),
    stop_reason: stopReason,
    mastery_claim: "insufficient_delayed_evidence",
    privacy: "learning_record"
  };
}
