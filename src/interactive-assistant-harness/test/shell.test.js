import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("shell launches the activity without persistent host chrome and keeps an opaque-origin sandbox", async () => {
  const html = await readFile(path.join(ROOT, "public/index.html"), "utf8");
  const script = await readFile(path.join(ROOT, "public/host-app.js"), "utf8");
  assert.match(html, /role="status"/);
  assert.match(html, /class="sr-only"/);
  assert.doesNotMatch(html, /<header|<nav|id="start"|id="pause"|id="stop"/);
  assert.match(script, /launchActivity\(\);/);
  assert.match(script, /could not be loaded\.\", true/);
  assert.doesNotMatch(script, /querySelector\("#(?:start|pause|stop)"\)/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
});

test("shell and fixture support focus, reduced motion, and non-timed interaction", async () => {
  const shellCss = await readFile(path.join(ROOT, "public/styles.css"), "utf8");
  const fixtureCss = await readFile(path.join(ROOT, "fixture/fixture.css"), "utf8");
  const fixtureHtml = await readFile(path.join(ROOT, "fixture/index.html"), "utf8");
  assert.match(shellCss, /focus-visible/);
  assert.match(shellCss, /prefers-reduced-motion/);
  assert.match(fixtureCss, /focus-visible/);
  assert.match(fixtureCss, /prefers-reduced-motion/);
  assert.match(fixtureHtml, /aria-labelledby="prompt"/);
  assert.doesNotMatch(fixtureHtml, /canvas|autoplay|countdown/);
});
