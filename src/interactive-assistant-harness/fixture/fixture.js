(() => {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session");
  let sequence = 0;
  let configuration;
  const prompt = document.querySelector("#prompt");
  const options = document.querySelector("#options");
  const feedback = document.querySelector("#feedback");

  function send(type, payload, causedBy = null, privacy = "ephemeral") {
    parent.postMessage({
      protocol: "tutor.assistant/v1",
      session_id: sessionId,
      sequence: sequence++,
      message_id: `assistant-${crypto.randomUUID()}`,
      caused_by: causedBy,
      sent_at: performance.now(),
      type,
      payload,
      privacy,
      schema_version: 1
    }, "*");
  }

  addEventListener("message", (event) => {
    if (event.source !== parent || event.origin === "null") return;
    const message = event.data;
    if (message?.protocol !== "tutor.assistant/v1" || message.session_id !== sessionId) return;
    if (message.type === "session.initialize") {
      configuration = message.payload;
      prompt.textContent = configuration.prompt;
      options.replaceChildren(...configuration.options.map((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = option.label;
        button.addEventListener("click", () => {
          const correct = option.id === configuration.answer;
          feedback.textContent = correct ? "That matches the rule." : "That does not match yet.";
          send("attempt.recorded", { item_id: option.id, correct, scaffold: "none" }, message.message_id, "learning_record");
        });
        return button;
      }));
      send("session.ready", { capabilities: ["attempt.recorded", "session.stop"], configuration_digest: "fixture" }, message.message_id);
    }
    if (message.type === "session.pause") options.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    if (message.type === "session.resume") options.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    if (message.type === "session.stop") {
      options.replaceChildren();
      feedback.textContent = "Stopped.";
    }
  });
})();
