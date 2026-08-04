(() => {
  const protocol = "tutor.assistant/v1";
  const sessionId = new URLSearchParams(location.search).get("session");
  const prompt = document.querySelector("#prompt");
  const controls = document.querySelector("section");
  const input = document.querySelector("input");
  const check = document.querySelector("button");
  const status = document.querySelector("[role=status]");
  let sequence = 0;
  let config;
  function send(type, payload, privacy = "ephemeral") {
    parent.postMessage({ protocol, session_id: sessionId, sequence: sequence++, message_id: `assistant-${crypto.randomUUID()}`, caused_by: null, sent_at: performance.now(), type, payload, privacy, schema_version: 1 }, "*");
  }
  addEventListener("message", (event) => {
    if (event.source !== parent || event.origin === "null" || event.data?.protocol !== protocol || event.data.session_id !== sessionId) return;
    if (event.data.type === "session.initialize") { config = event.data.payload; prompt.textContent = config.prompt; send("session.ready", { capabilities: ["attempt.recorded"], build_mode: "generated-app" }); }
    if (event.data.type === "session.stop") { controls.remove(); status.textContent = "Stopped."; }
  });
  function submitAttempt() {
    if (!input.value.trim()) { status.textContent = "Enter an estimate first."; return; }
    const normalized = input.value.trim().toLowerCase();
    const correct = config.accepted_answers.includes(normalized);
    status.textContent = correct ? "Good estimate." : "Ten percent means divide by ten; try once more.";
    send("attempt.recorded", { objective_id: config.objective_id, correct, scaffold: "none" }, "learning_record");
    input.select();
  }
  check.addEventListener("click", submitAttempt);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") submitAttempt(); });
})();
