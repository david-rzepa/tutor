import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ACTIVITY_BUDGET } from "../../examples/interactive-assistants/budget.js";
import { buildConfiguredActivity, buildGeneratedActivity } from "../../examples/interactive-assistants/build.js";

test("configuration and generated-code paths build inside the interactive budget", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "tutor-build-test-"));
  try {
    const configured = await buildConfiguredActivity({ sourcePath: path.resolve("examples/interactive-assistants/configs/science-change.json"), outputRoot: output });
    const generated = await buildGeneratedActivity({ sourceDir: path.resolve("examples/interactive-assistants/sources/adult-math-app"), outputRoot: output });
    assert.equal(configured.manifest.mode, "template-config");
    assert.equal(generated.manifest.mode, "generated-app");
    assert.equal(configured.fallback, false);
    assert.equal(generated.fallback, false);
    assert.equal(configured.manifest.presentation.learner_persona, "age-11");
    assert.equal(generated.manifest.presentation.learner_persona, "adult");
    assert.match(generated.manifest.session_config.prompt, /\?/);
    assert.ok(configured.buildMilliseconds <= ACTIVITY_BUDGET.targetBuildMilliseconds);
    assert.ok(generated.buildMilliseconds <= ACTIVITY_BUDGET.targetBuildMilliseconds);
    assert.ok(generated.totalBytes <= ACTIVITY_BUDGET.maxGeneratedAppBytes);
    assert.ok(generated.manifest.files.length <= ACTIVITY_BUDGET.maxGeneratedFiles);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("template and generated paths provide an explicit terminal presentation", async () => {
  const templateHtml = await readFile(path.resolve("examples/interactive-assistants/template/index.html"), "utf8");
  const templateScript = await readFile(path.resolve("examples/interactive-assistants/template/card.js"), "utf8");
  const generatedHtml = await readFile(path.resolve("examples/interactive-assistants/sources/adult-math-app/index.html"), "utf8");
  const generatedScript = await readFile(path.resolve("examples/interactive-assistants/sources/adult-math-app/app.js"), "utf8");
  for (const html of [templateHtml, generatedHtml]) {
    assert.match(html, />Activity complete</);
    assert.match(html, /There are no more questions in this activity\./);
  }
  for (const script of [templateScript, generatedScript]) {
    assert.match(script, /completion\.hidden = false/);
    assert.match(script, /completion\.focus\(\)/);
  }
});

test("unsafe generated code falls back deterministically to a reviewed card", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-unsafe-app-"));
  const source = path.join(base, "source");
  const output = path.join(base, "output");
  await mkdir(source);
  try {
    await writeFile(path.join(source, "activity.json"), JSON.stringify({
      schema: "tutor.generated-activity/v1", activity_id: "unsafe_app", objective: { id: "unsafe_goal", label: "Unsafe" },
      entry: "index.html", limits: { ui_states: 1, max_agent_callbacks: 0 }, session_config: {}
    }));
    await writeFile(path.join(source, "index.html"), '<html lang="en"><main>Unsafe</main><script src="app.js"></script></html>');
    await writeFile(path.join(source, "app.js"), 'const protocol="tutor.assistant/v1"; fetch("https://example.com/")');
    const built = await buildGeneratedActivity({ sourceDir: source, outputRoot: output });
    assert.equal(built.fallback, true);
    assert.equal(built.manifest.activity_id, "reviewed_fallback");
    assert.match(built.validationErrors.join(" "), /forbidden capability/);
    const fallback = JSON.parse(await readFile(path.join(output, "reviewed_fallback", "config.json"), "utf8"));
    assert.equal(fallback.schema, "tutor.activity-card/v1");
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("malformed configuration also produces the same reviewed fallback", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-invalid-config-"));
  try {
    const source = path.join(base, "broken.json"); await writeFile(source, "{broken");
    const built = await buildConfiguredActivity({ sourcePath: source, outputRoot: path.join(base, "output") });
    assert.equal(built.fallback, true);
    assert.equal(built.manifest.activity_id, "reviewed_fallback");
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("generated app configuration cannot include private learner records", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "tutor-private-app-"));
  const source = path.join(base, "source");
  await mkdir(source);
  try {
    await writeFile(path.join(source, "activity.json"), JSON.stringify({
      schema: "tutor.generated-activity/v1", activity_id: "private_app", objective: { id: "safe_goal", label: "Safe" },
      entry: "index.html", limits: { ui_states: 1, max_agent_callbacks: 0 }, session_config: { transcript: "private exchange" }
    }));
    await writeFile(path.join(source, "index.html"), '<html lang="en"><main>Safe</main><script src="app.js"></script></html>');
    await writeFile(path.join(source, "app.js"), 'const protocol="tutor.assistant/v1";');
    const built = await buildGeneratedActivity({ sourceDir: source, outputRoot: path.join(base, "output") });
    assert.equal(built.fallback, true);
    assert.match(built.validationErrors.join(" "), /private profile or transcript/);
  } finally { await rm(base, { recursive: true, force: true }); }
});
