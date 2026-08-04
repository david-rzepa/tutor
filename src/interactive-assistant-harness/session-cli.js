import { randomUUID } from "node:crypto";

const command = process.argv[2];
const baseUrl = process.env.TUTOR_SESSION_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl ?? "")) throw new Error("TUTOR_SESSION_URL must be a loopback harness URL");

async function json(response) {
  const value = await response.json();
  if (!response.ok) throw new Error(`Harness rejected the request: ${value.error ?? response.status}`);
  return value;
}

if (command === "create") {
  const bootstrap = process.env.TUTOR_BOOTSTRAP_TOKEN;
  const session = await json(await fetch(`${baseUrl}/api/sessions`, { method: "POST", headers: { Authorization: `Bearer ${bootstrap}` } }));
  console.log(JSON.stringify({
    schema: "tutor.codex-session/v1", session_id: session.session_id, agent_token: session.agent_token,
    learner_url: `${baseUrl}/?session=${encodeURIComponent(session.session_id)}#learner=${encodeURIComponent(session.learner_token)}`
  }));
} else {
  const sessionId = process.env.TUTOR_SESSION_ID;
  const agentToken = process.env.TUTOR_AGENT_TOKEN;
  if (!/^ses_[a-f0-9]{32}$/.test(sessionId ?? "") || !agentToken) throw new Error("TUTOR_SESSION_ID and TUTOR_AGENT_TOKEN are required");
  const headers = { Authorization: `Bearer ${agentToken}`, "X-Tutor-Role": "agent" };
  if (command === "wait") {
    const after = Number.parseInt(process.argv[3] ?? "0", 10);
    await json(await fetch(`${baseUrl}/api/sessions/${sessionId}/heartbeat`, { method: "POST", headers }));
    console.log(JSON.stringify(await json(await fetch(`${baseUrl}/api/sessions/${sessionId}/events?after=${after}&wait=25000`, { headers }))));
  } else if (command === "send") {
    const type = process.argv[3];
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "") || "{}");
    const event = await json(await fetch(`${baseUrl}/api/sessions/${sessionId}/events`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: `agent-${randomUUID()}`, type, payload })
    }));
    console.log(JSON.stringify(event));
  } else throw new Error("Usage: session-cli.js create | wait [after] | send TYPE");
}
