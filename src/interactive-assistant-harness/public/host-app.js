import { HostBridge, HostSecurityError } from "/harness/bridge.js";

const activityShell = document.querySelector("#activity-shell");
const tutorShell = document.querySelector("#tutor-shell");
const directFrame = document.querySelector("#assistant");
const directStatus = document.querySelector("#status");
const frameBridges = new Map();

function setDirectStatus(text, visible = false) {
  directStatus.textContent = text;
  directStatus.classList.toggle("sr-only", !visible);
}

async function selectActivity(card = new URL(location.href).searchParams.get("card")) {
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

function attachActivity(frame, configuration, onMessage) {
  frame.addEventListener("load", () => {
    if (!frame.src || frame.src === "about:blank") return;
    const sessionId = new URL(frame.src).searchParams.get("session");
    const bridge = new HostBridge({
      sessionId, expectedSource: frame.contentWindow,
      postMessage: (message) => frame.contentWindow.postMessage(message, "*"),
      onStateChange: (state, message) => onMessage(bridge, state, message)
    });
    frameBridges.set(frame, bridge);
    bridge.initialize(configuration);
  }, { once: true });
}

async function launchDirectActivity() {
  setDirectStatus("Loading activity...");
  try {
    const selected = await selectActivity();
    attachActivity(directFrame, selected.configuration, (bridge, _state, message) => {
      if (message.type === "session.ready") setDirectStatus("Activity ready.");
      if (message.type === "attempt.recorded") setDirectStatus(message.payload.correct ? "That matches." : "Use the feedback and try again.");
      if (message.type === "adaptation.requested") bridge.send("adaptation.applied", {
        dimension: "scaffold", scaffold: message.payload.direction === "fade" ? "none" : "guided", rationale_code: "bounded_demo_policy"
      }, { causedBy: message.message_id });
      if (message.type === "session.stop") setDirectStatus("Activity ended.", true);
    });
    directFrame.src = `${selected.entry}?session=${encodeURIComponent(crypto.randomUUID())}`;
  } catch { setDirectStatus("This activity could not be loaded.", true); }
}

function sessionCapability() {
  const token = new URLSearchParams(location.hash.slice(1)).get("learner");
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(token) ? token : null;
}

async function runTutorSession(sessionId, token) {
  const timeline = document.querySelector("#timeline");
  const connection = document.querySelector("#connection");
  const form = document.querySelector("#chat-form");
  const input = document.querySelector("#learner-message");
  const send = document.querySelector("#send-message");
  const stop = document.querySelector("#stop-session");
  const seen = new Set();
  let cursor = 0;
  let ended = false;

  const headers = (json = false) => ({ Authorization: `Bearer ${token}`, "X-Tutor-Role": "learner", ...(json ? { "Content-Type": "application/json" } : {}) });
  const path = `/api/sessions/${sessionId}`;
  const setConnection = (text, connected = false) => {
    connection.textContent = text;
    connection.dataset.connected = String(connected);
  };

  async function post(type, payload, messageId = `learner-${crypto.randomUUID()}`) {
    const response = await fetch(`${path}/events`, {
      method: "POST", headers: headers(true), body: JSON.stringify({ message_id: messageId, type, payload })
    });
    if (!response.ok) throw new Error("Session event was rejected");
    render(await response.json());
  }

  function addText(kind, text) {
    const item = document.createElement("li");
    item.className = `event event--${kind}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    item.append(paragraph);
    timeline.append(item);
  }

  async function addActivity(event) {
    const item = document.createElement("li");
    item.className = "event event--agent activity-card";
    const heading = document.createElement("h2");
    heading.textContent = event.payload.label ?? "Try this activity";
    const frame = document.createElement("iframe");
    frame.title = event.payload.label ?? "Interactive learning activity";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    item.append(heading, frame);
    timeline.append(item);
    try {
      const selected = await selectActivity(event.payload.activity_id);
      attachActivity(frame, selected.configuration, (bridge, state, message) => {
        if (message.type === "adaptation.requested") bridge.send("adaptation.applied", {
          dimension: "scaffold", scaffold: message.payload.direction === "fade" ? "none" : "guided", rationale_code: "bounded_local_policy"
        }, { causedBy: message.message_id });
        if (message.type === "attempt.recorded") post("activity.attempt", {
          activity_id: event.payload.activity_id, correct: Boolean(message.payload.correct), attempt_count: state.attempts.length
        }).catch(() => setConnection("Your tutor could not receive the activity result."));
        if (message.type === "help.requested") post("activity.help", { activity_id: event.payload.activity_id }).catch(() => setConnection("Your tutor could not receive the help request."));
      });
      frame.src = `${selected.entry}?session=${encodeURIComponent(crypto.randomUUID())}`;
    } catch {
      item.replaceChildren(heading);
      addText("notice", "This activity could not be loaded. Your tutor can provide another route.");
    }
  }

  function render(event) {
    if (seen.has(event.sequence)) return;
    seen.add(event.sequence);
    cursor = Math.max(cursor, event.sequence);
    if (event.type === "learner.message") addText("learner", event.payload.text);
    if (event.type === "tutor.message") { addText("agent", event.payload.text); send.disabled = false; setConnection("Tutor connected", true); }
    if (event.type === "tutor.status") setConnection(event.payload.text, true);
    if (event.type === "activity.inline") addActivity(event);
    if (event.type === "session.stop" || event.type === "session.complete") {
      ended = true; send.disabled = true; input.disabled = true; stop.disabled = true;
      addText("notice", event.payload.text ?? "This session has ended.");
    }
    timeline.lastElementChild?.scrollIntoView({ block: "nearest" });
  }

  async function poll() {
    if (ended) return;
    try {
      const response = await fetch(`${path}/events?after=${cursor}&wait=10000`, { headers: headers() });
      if (!response.ok) throw new Error("Session read failed");
      const batch = await response.json();
      for (const event of batch.events) render(event);
      const statusResponse = await fetch(`${path}/status`, { headers: headers() });
      if (!statusResponse.ok) throw new Error("Session status failed");
      const status = await statusResponse.json();
      if (!status.agent_connected && !send.disabled) setConnection("Waiting for the tutor to reconnect…");
      if (batch.stopped) ended = true;
    } catch { setConnection("Connection lost. Retrying…"); }
    if (!ended) setTimeout(poll, 250);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || ended) return;
    send.disabled = true;
    setConnection("Waiting for your tutor…", true);
    try { await post("learner.message", { text }); input.value = ""; }
    catch { send.disabled = false; setConnection("Message not sent. Try again."); }
  });
  stop.addEventListener("click", () => post("session.stop", { reason: "learner_choice" }).catch(() => setConnection("The session could not be stopped cleanly.")));
  poll();
  input.focus();
}

window.addEventListener("message", (event) => {
  for (const bridge of frameBridges.values()) {
    try { bridge.receive(event); return; }
    catch (error) {
      if (error instanceof HostSecurityError) continue;
      try { bridge.send("session.stop", { reason: "protocol_error" }); } catch {}
      return;
    }
  }
});

const requestedSession = new URL(location.href).searchParams.get("session");
if (requestedSession) {
  activityShell.hidden = true;
  tutorShell.hidden = false;
  const capability = sessionCapability();
  if (/^ses_[a-f0-9]{32}$/.test(requestedSession) && capability) runTutorSession(requestedSession, capability);
  else document.querySelector("#connection").textContent = "This session link is invalid.";
} else {
  launchDirectActivity();
}
