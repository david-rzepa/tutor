import { listenHarness } from "./server.js";

const requested = Number.parseInt(process.env.TUTOR_HARNESS_PORT ?? "0", 10);
const generatedRoot = process.env.TUTOR_GENERATED_ROOT;
const { url, bootstrapToken } = await listenHarness({
  port: Number.isSafeInteger(requested) ? requested : 0,
  ...(generatedRoot ? { generatedRoot } : {})
});
console.log(JSON.stringify({ schema: "tutor.harness-ready/v1", url, bootstrap_token: bootstrapToken }));
