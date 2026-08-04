(() => {
  document.documentElement.dataset.subject = "math";
  const protocol = "tutor.assistant/v1";
  const sessionId = new URLSearchParams(location.search).get("session");
  const prompt = document.querySelector("#prompt");
  const controls = document.querySelector("#response");
  const input = document.querySelector("input");
  const check = document.querySelector("#check");
  const hint = document.querySelector("#hint");
  const helpActions = document.querySelector("#help-actions");
  const help = document.querySelector("#help");
  const status = document.querySelector("[role=status]");
  const completion = document.querySelector("#completion");
  let sequence = 0;
  let config;
  function send(type, payload, privacy = "ephemeral") {
    parent.postMessage({ protocol, session_id: sessionId, sequence: sequence++, message_id: `assistant-${crypto.randomUUID()}`, caused_by: null, sent_at: performance.now(), type, payload, privacy, schema_version: 1 }, "*");
  }
  addEventListener("message", (event) => {
    if (event.source !== parent || event.origin === "null" || event.data?.protocol !== protocol || event.data.session_id !== sessionId) return;
    if (event.data.type === "session.initialize") { config = event.data.payload; prompt.textContent = config.prompt; hint.textContent = config.hint; send("session.ready", { capabilities: ["attempt.recorded", "help.requested"], build_mode: "generated-app" }); }
    if (event.data.type === "session.stop") {
      controls.remove();
      helpActions.remove();
      completion.querySelector("h2").textContent = "Activity ended";
      completion.querySelector("p").textContent = "You can close this page.";
      completion.hidden = false;
      completion.focus();
      status.textContent = "Activity ended.";
    }
  });
  function submitAttempt() {
    if (!input.value.trim()) { status.textContent = "Enter an estimate first."; return; }
    const normalized = input.value.trim().toLowerCase();
    const correct = config.accepted_answers.includes(normalized);
    status.textContent = correct ? "Good estimate. Activity complete." : "Ten percent means divide by ten; try once more.";
    send("attempt.recorded", { objective_id: config.objective_id, correct, scaffold: "none", complete: correct }, "learning_record");
    if (correct) {
      controls.remove();
      helpActions.remove();
      hint.hidden = true;
      completion.hidden = false;
      completion.focus();
    } else input.select();
  }
  check.addEventListener("click", submitAttempt);
  help.addEventListener("click", () => {
    if (!config) return;
    hint.hidden = false;
    help.remove();
    status.textContent = "Here is one hint. You can try the question now.";
    send("help.requested", { objective_id: config.objective_id, scaffold: "hint", help_count: 1 }, "learning_record");
    input.focus();
  });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") submitAttempt(); });
})();
