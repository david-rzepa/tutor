export function createActivityState(config) {
  return { config, attempts: 0, errors: 0, scaffold: "none", sequence: [], complete: false };
}

const normalize = (value) => String(value).trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function evaluateResponse(state, response) {
  if (state.complete) throw new Error("activity is complete");
  const { config } = state;
  let correct = false;
  if (config.mechanic === "choice") correct = response === config.answer;
  if (config.mechanic === "sequence") correct = Array.isArray(response) && response.join("|") === config.answer.join("|");
  if (config.mechanic === "recall") correct = config.answer.map(normalize).includes(normalize(response));
  const next = {
    ...state,
    attempts: state.attempts + 1,
    errors: state.errors + (correct ? 0 : 1),
    complete: correct || state.attempts + 1 >= config.limits.max_attempts
  };
  let adaptation = null;
  if (!correct && next.errors === config.scaffold.after_errors && state.scaffold === "none") {
    adaptation = { dimension: "scaffold", direction: "increase", proposed: "guided", preserves_objective: true, observed: { target_errors: next.errors } };
  } else if (correct && state.scaffold === "guided") {
    adaptation = { dimension: "scaffold", direction: "fade", proposed: "none", preserves_objective: true, observed: { guided_success: 1 } };
  }
  return { state: next, correct, feedback: correct ? config.feedback.correct : config.feedback.retry, adaptation };
}

export function applyAdaptation(state, response) {
  if (response.dimension !== "scaffold" || !["guided", "none"].includes(response.scaffold)) throw new Error("unsupported adaptation");
  return { ...state, scaffold: response.scaffold };
}
