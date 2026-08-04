import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { listenHarness } from "../server.js";

async function withServer(run) {
  const { server, url } = await listenHarness();
  try { await run({ server, url }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
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

test("all shell assets needed after load are local and available offline", async () => withServer(async ({ url }) => {
  for (const path of ["/", "/styles.css", "/host-app.js", "/harness/bridge.js", "/packages/teaching-tools/src/index.js", "/fixture/index.html", "/fixture/fixture.css", "/fixture/fixture.js"]) {
    const response = await fetch(`${url}${path === "/" ? "" : path}`);
    assert.equal(response.status, 200, path);
  }
}));
