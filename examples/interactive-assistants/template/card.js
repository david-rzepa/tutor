import { applyAdaptation, createActivityState, evaluateResponse } from "./engine.js";

const params = new URLSearchParams(location.search);
const sessionId = params.get("session");
const intro = document.querySelector("#intro");
const question = document.querySelector("#question");
const guidance = document.querySelector("#guidance");
const completion = document.querySelector("#completion");
const objective = document.querySelector("#objective");
const prompt = document.querySelector("#prompt");
const questionPrompt = document.querySelector("#question-prompt");
const continueButton = document.querySelector("#continue");
const interaction = document.querySelector("#interaction");
const helpActions = document.querySelector("#help-actions");
const help = document.querySelector("#help");
const guidanceTitle = document.querySelector("#guidance-title");
const feedback = document.querySelector("#feedback");
const hint = document.querySelector("#hint");
const retry = document.querySelector("#retry");
const completionMessage = document.querySelector("#completion-message");
let sequence = 0;
let state;
let pendingAdaptation;
let helpUsed = false;

function send(type, payload, causedBy = null, privacy = "ephemeral") {
  const messageId = `assistant-${crypto.randomUUID()}`;
  parent.postMessage({
    protocol: "tutor.assistant/v1", session_id: sessionId, sequence: sequence++, message_id: messageId,
    caused_by: causedBy, sent_at: performance.now(), type, payload, privacy, schema_version: 1
  }, "*");
  return messageId;
}

function showStage(stage) {
  for (const candidate of [intro, question, guidance, completion]) candidate.hidden = candidate !== stage;
  stage.focus();
}

function showGuidance(title, message) {
  guidanceTitle.textContent = title;
  feedback.textContent = message;
  hint.textContent = state.config.scaffold.hint;
  showStage(guidance);
}

function record(response) {
  const result = evaluateResponse(state, response);
  state = result.state;
  send("attempt.recorded", {
    objective_id: state.config.objective.id, correct: result.correct, scaffold: state.scaffold,
    attempt: state.attempts, complete: state.complete
  }, null, "learning_record");
  if (result.adaptation) pendingAdaptation = send("adaptation.requested", result.adaptation);
  if (state.complete) {
    completionMessage.textContent = result.correct
      ? `${result.feedback} There are no more questions in this activity.`
      : "This activity is finished. There are no more questions in this activity.";
    showStage(completion);
  }
  else showGuidance("Let's try that again", result.feedback);
}

function renderChoice() {
  const group = document.createElement("div");
  group.className = "choices";
  group.setAttribute("role", "group");
  group.setAttribute("aria-labelledby", "question-prompt");
  for (const item of state.config.items) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.addEventListener("click", () => record(item.id));
    group.append(button);
  }
  interaction.replaceChildren(group);
}

function renderSequence() {
  const chosen = [];
  const output = document.createElement("p");
  output.setAttribute("aria-live", "polite");
  const group = document.createElement("div");
  group.className = "choices";
  group.setAttribute("role", "group");
  group.setAttribute("aria-labelledby", "question-prompt");
  for (const item of state.config.items) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      chosen.push(item.id);
      button.disabled = true;
      output.textContent = chosen.map((id) => state.config.items.find((entry) => entry.id === id).label).join(" -> ");
      if (chosen.length === state.config.items.length) record(chosen);
    });
    group.append(button);
  }
  interaction.replaceChildren(group, output);
}

function renderRecall() {
  const form = document.createElement("form");
  const label = document.createElement("label");
  label.textContent = "Your answer ";
  const input = document.createElement("input");
  input.required = true;
  input.autocomplete = "off";
  label.append(input);
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Check";
  form.append(label, button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    record(input.value);
  });
  interaction.replaceChildren(form);
}

function renderInteraction() {
  if (state.config.mechanic === "choice") renderChoice();
  if (state.config.mechanic === "sequence") renderSequence();
  if (state.config.mechanic === "recall") renderRecall();
}

function initialize(config) {
  state = createActivityState(config);
  document.documentElement.dataset.subject = config.activity_id.split("_")[0];
  objective.textContent = config.objective.label;
  prompt.textContent = config.prompt;
  questionPrompt.textContent = config.prompt;
  renderInteraction();
  showStage(intro);
}

continueButton.addEventListener("click", () => showStage(question));
retry.addEventListener("click", () => {
  renderInteraction();
  showStage(question);
});

help.addEventListener("click", () => {
  if (!state || state.complete || helpUsed) return;
  helpUsed = true;
  help.remove();
  send("help.requested", { objective_id: state.config.objective.id, scaffold: "hint", help_count: 1 }, null, "learning_record");
  showGuidance("Here is a hint", "Read the hint, then continue when you are ready.");
});

addEventListener("message", (event) => {
  if (event.source !== parent || event.origin === "null") return;
  const message = event.data;
  if (message?.protocol !== "tutor.assistant/v1" || message.session_id !== sessionId) return;
  if (message.type === "session.initialize") {
    initialize(message.payload);
    send("session.ready", { capabilities: ["attempt.recorded", "adaptation.requested", "help.requested"], build_mode: "template-config" }, message.message_id);
  }
  if (message.type === "adaptation.applied" && message.caused_by === pendingAdaptation) {
    state = applyAdaptation(state, message.payload);
    pendingAdaptation = null;
  }
  if (message.type === "session.pause") document.querySelectorAll("button,input").forEach((control) => { control.disabled = true; });
  if (message.type === "session.resume") document.querySelectorAll("button,input").forEach((control) => { control.disabled = false; });
  if (message.type === "session.stop") {
    completion.querySelector("h2").textContent = "Activity ended";
    completion.querySelector("p").textContent = "You can close this page.";
    showStage(completion);
  }
});
