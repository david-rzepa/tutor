import { listenHarness } from "./server.js";

const requested = Number.parseInt(process.env.TUTOR_HARNESS_PORT ?? "0", 10);
const { url } = await listenHarness({ port: Number.isSafeInteger(requested) ? requested : 0 });
console.log(`Tutor harness listening at ${url}`);
