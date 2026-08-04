import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { listenHarness } from "../../src/interactive-assistant-harness/server.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function cli(relative, args, env, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, relative), ...args], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    const output = []; const errors = [];
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(Buffer.concat(output).toString("utf8"))) : reject(new Error(Buffer.concat(errors).toString("utf8") || `CLI exited ${code}`)));
    child.stdin.end(input);
  });
}

test("Codex CLI and browser capability complete an inline activity round trip without a model API", async () => {
  const generatedRoot = await mkdtemp(path.join(tmpdir(), "tutor-browser-session-"));
  const harness = await listenHarness({ generatedRoot });
  try {
    const created = await cli("src/interactive-assistant-harness/session-cli.js", ["create"], {
      TUTOR_SESSION_URL: harness.url, TUTOR_BOOTSTRAP_TOKEN: harness.bootstrapToken
    });
    const learnerUrl = new URL(created.learner_url);
    const learnerToken = new URLSearchParams(learnerUrl.hash.slice(1)).get("learner");
    assert.equal(learnerUrl.origin, harness.url);
    assert.equal(learnerUrl.searchParams.get("session"), created.session_id);

    const activity = {
      schema: "tutor.activity-card/v1", activity_id: "cooking_cli_roundtrip",
      objective: { id: "food_safety_steps", label: "Start cooking safely" }, mechanic: "choice",
      prompt: "What should you do before preparing food?",
      items: [{ id: "wash", label: "Wash hands and surfaces" }, { id: "mix", label: "Mix raw and cooked food" }], answer: "wash",
      feedback: { correct: "Yes. Begin clean.", retry: "Think about the Clean step." },
      scaffold: { hint: "Clean is the first of four food-safety steps.", after_errors: 2 },
      presentation: { learner_persona: "adult", accessible_alternative: "semantic text buttons" },
      limits: { max_attempts: 3, max_agent_callbacks: 1, ui_states: 4 },
      curriculum_ref: { curriculum_id: "cur_synthetic_cooking", graph_id: "grf_synthetic_cooking", node_id: "cap_food_safety", evidence_need: "provisional-varied-unaided" }
    };
    const published = await cli("src/interactive-assistant-harness/activity-cli.js", [], { TUTOR_GENERATED_ROOT: generatedRoot }, `\uFEFF${JSON.stringify(activity)}`);
    assert.equal(published.fallback, false);
    assert.equal((await fetch(`${harness.url}/examples/generated/${published.activity_id}/manifest.json`)).status, 200);

    const sessionPath = `${harness.url}/api/sessions/${created.session_id}`;
    await fetch(`${sessionPath}/events`, {
      method: "POST", headers: { Authorization: `Bearer ${learnerToken}`, "X-Tutor-Role": "learner", "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: "learner-cooking-request", type: "learner.message", payload: { text: "Teach me cooking" } })
    });
    const agentEnv = { TUTOR_SESSION_URL: harness.url, TUTOR_SESSION_ID: created.session_id, TUTOR_AGENT_TOKEN: created.agent_token };
    const received = await cli("src/interactive-assistant-harness/session-cli.js", ["wait", "0"], agentEnv);
    assert.equal(received.events[0].payload.text, "Teach me cooking");

    await cli("src/interactive-assistant-harness/session-cli.js", ["send", "tutor.message"], agentEnv, `\uFEFF${JSON.stringify({ text: "Let's learn one safe cooking habit." })}`);
    await cli("src/interactive-assistant-harness/session-cli.js", ["send", "activity.inline"], agentEnv, JSON.stringify({ activity_id: published.activity_id, label: "Start cooking safely" }));
    const timeline = await (await fetch(`${sessionPath}/events?after=0`, { headers: { Authorization: `Bearer ${learnerToken}`, "X-Tutor-Role": "learner" } })).json();
    assert.deepEqual(timeline.events.map((event) => event.type), ["learner.message", "tutor.message", "activity.inline"]);
    assert.doesNotMatch(JSON.stringify(timeline), /OPENAI_API_KEY|api\.openai\.com/);
  } finally {
    await new Promise((resolve) => harness.server.close(resolve));
    await rm(generatedRoot, { recursive: true, force: true });
  }
});
