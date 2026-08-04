import test from "node:test";
import assert from "node:assert/strict";
import { listenHarness } from "../../src/interactive-assistant-harness/server.js";

test("built configuration and generated apps are served only through allowlisted local mounts", async () => {
  const { server, url } = await listenHarness();
  try {
    for (const path of [
      "/examples/generated/science_change/manifest.json",
      "/examples/generated/science_change/config.json",
      "/examples/generated/music_order/manifest.json",
      "/examples/generated/adult_math_recall/manifest.json",
      "/examples/generated/adult_math_recall/app/index.html",
      "/examples/generated/adult_math_recall/app/app.js"
    ]) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-security-policy"), /connect-src 'none'/);
    }
    assert.equal((await fetch(`${url}/examples/configs/science-change.json`)).status, 404);
    assert.equal((await fetch(`${url}/examples/generated/../configs/science-change.json`)).status, 404);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
