import { applyAdaptation, createActivityState, evaluateResponse } from "./engine.js";

const params = new URLSearchParams(location.search);
const sessionId = params.get("session");
const objective = document.querySelector("#objective");
const prompt = document.querySelector("#prompt");
const hint = document.querySelector("#hint");
const interaction = document.querySelector("#interaction");
const feedback = document.querySelector("#feedback");
const completion = document.querySelector("#completion");
let sequence = 0;
let state;
let pendingAdaptation;

function send(type, payload, causedBy = null, privacy = "ephemeral") {
  const messageId = `assistant-${crypto.randomUUID()}`;
  parent.postMessage({
    protocol: "tutor.assistant/v1", session_id: sessionId, sequence: sequence++, message_id: messageId,
    caused_by: causedBy, sent_at: performance.now(), type, payload, privacy, schema_version: 1
  }, "*");
  return messageId;
}

function record(response) {
  const result = evaluateResponse(state, response);
  state = result.state;
  feedback.textContent = state.complete
    ? `${result.correct ? result.feedback : "This question is finished."} Activity complete.`
    : result.feedback;
  send("attempt.recorded", {
    objective_id: state.config.objective.id, correct: result.correct, scaffold: state.scaffold,
    attempt: state.attempts, complete: state.complete
  }, null, "learning_record");
  if (result.adaptation) pendingAdaptation = send("adaptation.requested", result.adaptation);
  if (state.complete) {
    interaction.replaceChildren();
    hint.hidden = true;
    completion.hidden = false;
    completion.focus();
  }
}

function renderChoice() {
  const group = document.createElement("div"); group.className = "choices"; group.setAttribute("role", "group"); group.setAttribute("aria-labelledby", "prompt");
  for (const item of state.config.items) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = item.label;
    button.addEventListener("click", () => record(item.id)); group.append(button);
  }
  interaction.replaceChildren(group);
}

function renderSequence() {
  const chosen = [];
  const output = document.createElement("p"); output.setAttribute("aria-live", "polite");
  const group = document.createElement("div"); group.className = "choices"; group.setAttribute("role", "group"); group.setAttribute("aria-labelledby", "prompt");
  for (const item of state.config.items) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = item.label;
    button.addEventListener("click", () => {
      chosen.push(item.id); button.disabled = true; output.textContent = chosen.map((id) => state.config.items.find((entry) => entry.id === id).label).join(" → ");
      if (chosen.length === state.config.items.length) { record(chosen); chosen.splice(0); group.querySelectorAll("button").forEach((control) => { control.disabled = state.complete; }); }
    });
    group.append(button);
  }
  interaction.replaceChildren(group, output);
}

function renderRecall() {
  const form = document.createElement("form");
  const label = document.createElement("label"); label.textContent = "Your answer ";
  const input = document.createElement("input"); input.required = true; input.autocomplete = "off"; label.append(input);
  const button = document.createElement("button"); button.type = "submit"; button.textContent = "Check";
  form.append(label, button); form.addEventListener("submit", (event) => { event.preventDefault(); record(input.value); input.select(); });
  interaction.replaceChildren(form);
}

function initialize(config) {
  state = createActivityState(config); objective.textContent = config.objective.label; prompt.textContent = config.prompt; hint.textContent = config.scaffold.hint;
  if (config.mechanic === "choice") renderChoice();
  if (config.mechanic === "sequence") renderSequence();
  if (config.mechanic === "recall") renderRecall();
}

addEventListener("message", (event) => {
  if (event.source !== parent || event.origin === "null") return;
  const message = event.data;
  if (message?.protocol !== "tutor.assistant/v1" || message.session_id !== sessionId) return;
  if (message.type === "session.initialize") {
    initialize(message.payload);
    send("session.ready", { capabilities: ["attempt.recorded", "adaptation.requested"], build_mode: "template-config" }, message.message_id);
  }
  if (message.type === "adaptation.applied" && message.caused_by === pendingAdaptation) {
    state = applyAdaptation(state, message.payload); pendingAdaptation = null;
    hint.hidden = state.scaffold !== "guided";
  }
  if (message.type === "session.pause") interaction.querySelectorAll("button,input").forEach((control) => { control.disabled = true; });
  if (message.type === "session.resume") interaction.querySelectorAll("button,input").forEach((control) => { control.disabled = state.complete; });
  if (message.type === "session.stop") {
    interaction.replaceChildren();
    completion.querySelector("h2").textContent = "Activity ended";
    completion.querySelector("p").textContent = "You can close this page.";
    completion.hidden = false;
    completion.focus();
    feedback.textContent = "Activity ended.";
  }
});
