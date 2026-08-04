import { HostBridge, HostSecurityError } from "/harness/bridge.js";

const frame = document.querySelector("#assistant");
const start = document.querySelector("#start");
const pause = document.querySelector("#pause");
const stop = document.querySelector("#stop");
const status = document.querySelector("#status");
let bridge;

function setStatus(text) { status.textContent = text; }

function configureControls(state) {
  const active = state === "running" || state === "paused";
  start.disabled = active;
  pause.disabled = !active;
  pause.textContent = state === "paused" ? "Resume" : "Pause";
  stop.disabled = !active;
}

start.addEventListener("click", () => {
  frame.hidden = false;
  frame.src = `/fixture/index.html?session=${encodeURIComponent(crypto.randomUUID())}`;
  setStatus("Loading activity…");
});

frame.addEventListener("load", () => {
  const sessionId = new URL(frame.src).searchParams.get("session");
  bridge = new HostBridge({
    sessionId,
    expectedSource: frame.contentWindow,
    postMessage: (message) => frame.contentWindow.postMessage(message, "*"),
    onStateChange: (state, message) => {
      configureControls(state.status);
      if (message.type === "session.ready") setStatus("Activity ready.");
      if (message.type === "attempt.recorded") setStatus(message.payload.correct ? "That matches." : "Try the other choice or ask for help.");
      if (message.type === "session.stop") setStatus("Activity stopped.");
    }
  });
  bridge.initialize({
    objective_id: "generic.classification",
    prompt: "Which option matches the rule: choose the larger number?",
    options: [{ id: "a", label: "3" }, { id: "b", label: "8" }],
    answer: "b",
    allowed_capabilities: ["attempt.recorded", "session.stop"],
    accessibility: { time_limit: false },
    privacy: "learning_record"
  });
});

window.addEventListener("message", (event) => {
  if (!bridge) return;
  try { bridge.receive(event); }
  catch (error) {
    if (error instanceof HostSecurityError) return;
    setStatus("The activity sent an invalid message and was stopped.");
    try { bridge.send("session.stop", { reason: "protocol_error" }); } catch {}
  }
});

pause.addEventListener("click", () => {
  if (!bridge) return;
  if (bridge.state.status === "paused") {
    bridge.send("session.resume", { reason: "learner" });
    setStatus("Activity resumed.");
  } else {
    bridge.send("session.pause", { reason: "learner" });
    setStatus("Activity paused.");
  }
  configureControls(bridge.state.status);
});

stop.addEventListener("click", () => {
  if (!bridge) return;
  bridge.send("session.stop", { reason: "learner" });
  setStatus("Activity stopped. Your choice is saved only if the learning record permits it.");
  configureControls(bridge.state.status);
});
