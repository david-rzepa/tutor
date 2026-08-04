import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { listenHarness } from "../server.js";

async function withServer(run) {
  const harness = await listenHarness();
  try { await run(harness); }
  finally { await new Promise((resolve) => harness.server.close(resolve)); }
}

test("serves the host and assistant with restrictive, distinct policies", async () => withServer(async ({ url }) => {
  const host = await fetch(url);
  assert.equal(host.status, 200);
  assert.match(host.headers.get("content-security-policy"), /frame-src 'self'/);
  assert.match(await host.text(), /sandbox="allow-scripts"/);

  const assistant = await fetch(`${url}/fixture/index.html`);
  assert.equal(assistant.status, 200);
  assert.match(assistant.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.match(assistant.headers.get("content-security-policy"), /script-src http:\/\/127\.0\.0\.1:\*/);
  assert.equal(assistant.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.doesNotMatch(assistant.headers.get("content-security-policy"), /unsafe-inline/);

  const toolkit = await fetch(`${url}/packages/teaching-tools/src/index.js`);
  assert.equal(toolkit.status, 200);
  assert.equal(toolkit.headers.get("x-content-type-options"), "nosniff");

  const template = await fetch(`${url}/examples/template/index.html`);
  assert.equal(template.status, 200);
  assert.match(template.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal(template.headers.get("access-control-allow-origin"), "*");
}));

test("rejects traversal, non-loopback hosts, writes, and unknown files", async () => withServer(async ({ server, url }) => {
  assert.equal((await fetch(`${url}/%2e%2e/package.json`)).status, 404);
  assert.equal((await fetch(`${url}/missing.js`)).status, 404);
  assert.equal((await fetch(url, { method: "POST" })).status, 405);

  const address = server.address();
  const status = await new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port: address.port, path: "/", headers: { Host: "evil.example" } }, (response) => {
      response.resume(); resolve(response.statusCode);
    });
    request.on("error", reject); request.end();
  });
  assert.equal(status, 421);
}));

test("exposes an authenticated loopback bridge with separate learner and Codex capabilities", async () => withServer(async ({ url, bootstrapToken }) => {
  const denied = await fetch(`${url}/api/sessions`, { method: "POST" });
  assert.equal(denied.status, 403);

  const createdResponse = await fetch(`${url}/api/sessions`, { method: "POST", headers: { Authorization: `Bearer ${bootstrapToken}` } });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const path = `${url}/api/sessions/${created.session_id}`;

  const heartbeat = await fetch(`${path}/heartbeat`, { method: "POST", headers: { Authorization: `Bearer ${created.agent_token}` } });
  assert.equal(heartbeat.status, 200);
  const learnerPost = await fetch(`${path}/events`, {
    method: "POST", headers: { Authorization: `Bearer ${created.learner_token}`, "X-Tutor-Role": "learner", "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: "learner-http-one", type: "learner.message", payload: { text: "Teach me cooking" } })
  });
  assert.equal(learnerPost.status, 201);

  const agentRead = await fetch(`${path}/events?after=0&wait=10`, { headers: { Authorization: `Bearer ${created.agent_token}`, "X-Tutor-Role": "agent" } });
  assert.equal(agentRead.status, 200);
  assert.equal((await agentRead.json()).events[0].payload.text, "Teach me cooking");

  const crossed = await fetch(`${path}/events`, { headers: { Authorization: `Bearer ${created.learner_token}`, "X-Tutor-Role": "agent" } });
  assert.equal(crossed.status, 403);
  assert.equal((await fetch(`${path}/status`, { headers: { Authorization: `Bearer ${created.learner_token}` } })).status, 200);
}));

test("all shell assets needed after load are local and available offline", async () => withServer(async ({ url }) => {
  for (const path of ["/", "/styles.css", "/host-app.js", "/harness/bridge.js", "/packages/teaching-tools/src/index.js", "/fixture/index.html", "/fixture/fixture.css", "/fixture/fixture.js", "/examples/template/index.html", "/examples/template/card.css", "/examples/template/card.js", "/examples/template/engine.js"]) {
    const response = await fetch(`${url}${path === "/" ? "" : path}`);
    assert.equal(response.status, 200, path);
  }
}));
