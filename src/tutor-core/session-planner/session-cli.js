import { planGroundedSession } from "./index.js";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks);
if (!input.length || input.length > 65_536) throw new Error("Expected one bounded grounded-subject packet on standard input");
const packet = JSON.parse(input.toString("utf8").replace(/^\uFEFF/, ""));
console.log(JSON.stringify(planGroundedSession(packet)));
