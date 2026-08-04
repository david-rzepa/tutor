import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { ACTIVITY_BUDGET, ActivityValidationError, validateActivityConfig, validateGeneratedApp } from "./budget.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUTPUT_ROOT = path.join(HERE, "generated");
const FALLBACK_PATH = path.join(HERE, "fallback.json");
const digest = (content) => createHash("sha256").update(content).digest("hex");

async function publishJson(outputRoot, activityId, config, metadata = {}) {
  const directory = path.join(outputRoot, activityId);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const configText = `${JSON.stringify(config, null, 2)}\n`;
  const manifest = {
    schema: "tutor.built-activity/v1",
    activity_id: activityId,
    mode: "template-config",
    entry: "/examples/template/index.html",
    config: "config.json",
    files: [{ path: "config.json", bytes: new TextEncoder().encode(configText).byteLength, sha256: digest(configText) }],
    budget: ACTIVITY_BUDGET,
    ...metadata
  };
  await writeFile(path.join(directory, "config.json"), configText, { encoding: "utf8", flag: "wx" });
  await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { directory, manifest };
}

export async function buildConfiguredActivity({ sourcePath, outputRoot = DEFAULT_OUTPUT_ROOT, fallbackPath = FALLBACK_PATH }) {
  const started = performance.now();
  let config;
  let fallback = false;
  let validationErrors = [];
  try {
    config = validateActivityConfig(JSON.parse(await readFile(sourcePath, "utf8")));
  } catch (error) {
    if (!(error instanceof ActivityValidationError || error instanceof SyntaxError)) throw error;
    fallback = true;
    validationErrors = error.errors ?? ["invalid JSON"];
    config = validateActivityConfig(JSON.parse(await readFile(fallbackPath, "utf8")));
  }
  const result = await publishJson(outputRoot, config.activity_id, config, { fallback, validation_errors: validationErrors });
  return { ...result, fallback, validationErrors, buildMilliseconds: performance.now() - started };
}

export async function buildGeneratedActivity({ sourceDir, outputRoot = DEFAULT_OUTPUT_ROOT, fallbackPath = FALLBACK_PATH }) {
  const started = performance.now();
  try {
    const manifest = JSON.parse(await readFile(path.join(sourceDir, "activity.json"), "utf8"));
    const names = (await readdir(sourceDir)).filter((name) => name !== "activity.json").sort();
    const files = await Promise.all(names.map(async (name) => ({ path: name, content: await readFile(path.join(sourceDir, name), "utf8") })));
    const validated = validateGeneratedApp({ manifest, files });
    const directory = path.join(outputRoot, manifest.activity_id);
    const appDirectory = path.join(directory, "app");
    await rm(directory, { recursive: true, force: true });
    await mkdir(appDirectory, { recursive: true });
    const fileRecords = [];
    for (const file of files) {
      await copyFile(path.join(sourceDir, file.path), path.join(appDirectory, file.path));
      fileRecords.push({ path: `app/${file.path}`, bytes: new TextEncoder().encode(file.content).byteLength, sha256: digest(file.content) });
    }
    const builtManifest = {
      schema: "tutor.built-activity/v1", activity_id: manifest.activity_id, mode: "generated-app",
      entry: `/examples/generated/${manifest.activity_id}/app/${manifest.entry}`,
      session_config: manifest.session_config, files: fileRecords, budget: ACTIVITY_BUDGET
    };
    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(builtManifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { directory, manifest: builtManifest, fallback: false, totalBytes: validated.totalBytes, buildMilliseconds: performance.now() - started };
  } catch (error) {
    if (!(error instanceof ActivityValidationError || error instanceof SyntaxError)) throw error;
    const fallbackConfig = validateActivityConfig(JSON.parse(await readFile(fallbackPath, "utf8")));
    const result = await publishJson(outputRoot, fallbackConfig.activity_id, fallbackConfig, { fallback: true, validation_errors: error.errors ?? ["invalid JSON"] });
    return { ...result, fallback: true, validationErrors: error.errors ?? ["invalid JSON"], buildMilliseconds: performance.now() - started };
  }
}

async function main() {
  const [mode, source, output = DEFAULT_OUTPUT_ROOT] = process.argv.slice(2);
  if (!source || !["config", "app"].includes(mode)) throw new Error("Usage: node build.js <config FILE|app DIR> [OUTPUT_DIR]");
  const result = mode === "config"
    ? await buildConfiguredActivity({ sourcePath: path.resolve(source), outputRoot: path.resolve(output) })
    : await buildGeneratedActivity({ sourceDir: path.resolve(source), outputRoot: path.resolve(output) });
  console.log(JSON.stringify({ activity_id: result.manifest.activity_id, mode: result.manifest.mode, fallback: result.fallback, build_ms: Math.round(result.buildMilliseconds) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
