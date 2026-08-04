import { buildActivityConfig, DEFAULT_OUTPUT_ROOT } from "../../examples/interactive-assistants/build.js";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks);
if (!input.length || input.length > 16_384) throw new Error("Expected one bounded activity configuration on standard input");
let config;
try { config = JSON.parse(input.toString("utf8").replace(/^\uFEFF/, "")); }
catch { config = null; }

const outputRoot = process.env.TUTOR_GENERATED_ROOT ?? DEFAULT_OUTPUT_ROOT;
const result = await buildActivityConfig({ config, outputRoot });
console.log(JSON.stringify({
  schema: "tutor.activity-published/v1", activity_id: result.manifest.activity_id,
  mode: result.manifest.mode, fallback: result.fallback, validation_errors: result.validationErrors ?? []
}));
