import { HostBridge, HostSecurityError } from "/harness/bridge.js";

const frame = document.querySelector("#assistant");
const start = document.querySelector("#start");
const pause = document.querySelector("#pause");
const stop = document.querySelector("#stop");
const status = document.querySelector("#status");
let bridge;
let pendingConfiguration;

function setStatus(text) { status.textContent = text; }

function configureControls(state) {
  const active = state === "running" || state === "paused";
  start.disabled = active;
  pause.disabled = !active;
  pause.textContent = state === "paused" ? "Resume" : "Pause";
  stop.disabled = !active;
}

async function selectActivity() {
  const card = new URL(location.href).searchParams.get("card");
  if (!card) return {
    entry: "/fixture/index.html",
    configuration: {
      objective_id: "generic.classification",
      prompt: "Which option matches the rule: choose the larger number?",
      options: [{ id: "a", label: "3" }, { id: "b", label: "8" }],
      answer: "b", allowed_capabilities: ["attempt.recorded", "session.stop"],
      accessibility: { time_limit: false }, privacy: "learning_record"
    }
  };
  if (!/^[a-z][a-z0-9_-]{2,79}$/.test(card)) throw new Error("Unsafe activity ID");
  const manifestResponse = await fetch(`/examples/generated/${card}/manifest.json`, { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("Activity manifest is unavailable");
  const manifest = await manifestResponse.json();
  if (manifest.schema !== "tutor.built-activity/v1" || manifest.activity_id !== card) throw new Error("Activity manifest is invalid");
  if (manifest.mode === "generated-app") {
    const expectedEntry = `/examples/generated/${card}/app/index.html`;
    if (manifest.entry !== expectedEntry || !manifest.session_config || typeof manifest.session_config !== "object") throw new Error("Generated application manifest is invalid");
    return { entry: manifest.entry, configuration: manifest.session_config };
  }
  if (manifest.mode !== "template-config") throw new Error("Unknown activity build mode");
  if (manifest.entry !== "/examples/template/index.html" || manifest.config !== "config.json") throw new Error("Template manifest is invalid");
  const configResponse = await fetch(`/examples/generated/${card}/${manifest.config}`, { cache: "no-store" });
  if (!configResponse.ok) throw new Error("Activity configuration is unavailable");
  return { entry: manifest.entry, configuration: await configResponse.json() };
}

start.addEventListener("click", async () => {
  start.disabled = true;
  setStatus("Loading activity...");
  try {
    const selected = await selectActivity();
    pendingConfiguration = selected.configuration;
    frame.hidden = false;
    frame.src = `${selected.entry}?session=${encodeURIComponent(crypto.randomUUID())}`;
  } catch {
    start.disabled = false;
    setStatus("The activity could not be validated. Choose a reviewed fallback.");
  }
});

frame.addEventListener("load", async () => {
  if (frame.hidden || !frame.src || frame.src === "about:blank") return;
  const sessionId = new URL(frame.src).searchParams.get("session");
  bridge = new HostBridge({
    sessionId,
    expectedSource: frame.contentWindow,
    postMessage: (message) => frame.contentWindow.postMessage(message, "*"),
    onStateChange: (state, message) => {
      configureControls(state.status);
      if (message.type === "session.ready") setStatus("Activity ready.");
      if (message.type === "attempt.recorded") setStatus(message.payload.correct ? "That matches." : "Use the feedback and try again.");
      if (message.type === "adaptation.requested") {
        bridge.send("adaptation.applied", {
          dimension: "scaffold",
          scaffold: message.payload.direction === "fade" ? "none" : "guided",
          rationale_code: "bounded_demo_policy"
        }, { causedBy: message.message_id });
      }
      if (message.type === "session.stop") setStatus("Activity stopped.");
    }
  });
  bridge.initialize(pendingConfiguration ?? (await selectActivity()).configuration);
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
