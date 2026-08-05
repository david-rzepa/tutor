(() => {
  document.documentElement.dataset.subject = "math";
  const protocol = "tutor.assistant/v1";
  const sessionId = new URLSearchParams(location.search).get("session");
  const intro = document.querySelector("#intro");
  const question = document.querySelector("#question");
  const guidance = document.querySelector("#guidance");
  const completion = document.querySelector("#completion");
  const prompt = document.querySelector("#prompt");
  const questionPrompt = document.querySelector("#question-prompt");
  const input = document.querySelector("input");
  const hint = document.querySelector("#hint");
  const help = document.querySelector("#help");
  const feedback = document.querySelector("#feedback");
  const guidanceTitle = document.querySelector("#guidance-title");
  const completionMessage = document.querySelector("#completion-message");
  let sequence = 0;
  let config;
  let helpUsed = false;

  function send(type, payload, privacy = "ephemeral") {
    parent.postMessage({ protocol, session_id: sessionId, sequence: sequence++, message_id: `assistant-${crypto.randomUUID()}`, caused_by: null, sent_at: performance.now(), type, payload, privacy, schema_version: 1 }, "*");
  }

  function showStage(stage) {
    for (const candidate of [intro, question, guidance, completion]) candidate.hidden = candidate !== stage;
    stage.focus();
  }

  function showGuidance(title, message) {
    guidanceTitle.textContent = title;
    feedback.textContent = message;
    hint.textContent = config.hint;
    showStage(guidance);
  }

  addEventListener("message", (event) => {
    if (event.source !== parent || event.origin === "null" || event.data?.protocol !== protocol || event.data.session_id !== sessionId) return;
    if (event.data.type === "session.initialize") {
      config = event.data.payload;
      prompt.textContent = config.prompt;
      questionPrompt.textContent = config.prompt;
      showStage(intro);
      send("session.ready", { capabilities: ["attempt.recorded", "help.requested"], build_mode: "generated-app" });
    }
    if (event.data.type === "session.stop") {
      completion.querySelector("h2").textContent = "Activity ended";
      completionMessage.textContent = "You can close this page.";
      showStage(completion);
    }
  });

  function submitAttempt() {
    if (!input.value.trim()) {
      showGuidance("One thing is missing", "Enter an estimate before you continue.");
      return;
    }
    const normalized = input.value.trim().toLowerCase();
    const correct = config.accepted_answers.includes(normalized);
    send("attempt.recorded", { objective_id: config.objective_id, correct, scaffold: helpUsed ? "hint" : "none", complete: correct }, "learning_record");
    if (correct) {
      completionMessage.textContent = "Good estimate. There are no more questions in this activity.";
      showStage(completion);
    } else {
      showGuidance("Let's try that again", "Ten percent means divide by ten.");
    }
  }

  document.querySelector("#continue").addEventListener("click", () => showStage(question));
  document.querySelector("#retry").addEventListener("click", () => {
    input.select();
    showStage(question);
  });
  document.querySelector("#check").addEventListener("click", submitAttempt);
  help.addEventListener("click", () => {
    if (!config || helpUsed) return;
    helpUsed = true;
    help.remove();
    send("help.requested", { objective_id: config.objective_id, scaffold: "hint", help_count: 1 }, "learning_record");
    showGuidance("Here is a hint", "Read the hint, then continue when you are ready.");
  });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") submitAttempt(); });
})();
