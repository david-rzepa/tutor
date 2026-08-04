import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SessionBrokerError, TutorSessionBroker } from "./session-broker.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

const DEFAULT_GENERATED_ROOT = path.join(REPO_ROOT, "examples/interactive-assistants/generated");
const mountsFor = (generatedRoot) => [
  { prefix: "/harness/", root: HERE, policy: "module" },
  { prefix: "/packages/teaching-tools/src/", root: path.join(REPO_ROOT, "packages/teaching-tools/src"), policy: "module" },
  { prefix: "/examples/template/", root: path.join(REPO_ROOT, "examples/interactive-assistants/template"), policy: "assistant" },
  { prefix: "/examples/generated/", root: path.resolve(generatedRoot), policy: "assistant" },
  { prefix: "/fixture/", root: path.join(HERE, "fixture"), policy: "assistant" },
  { prefix: "/", root: path.join(HERE, "public"), policy: "host" }
];

const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

const CSP = {
  host: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  assistant: "default-src 'none'; script-src http://127.0.0.1:*; style-src http://127.0.0.1:*; img-src data: http://127.0.0.1:*; media-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://127.0.0.1:*",
  module: "default-src 'none'; frame-ancestors 'none'"
};

function hostAllowed(host) {
  const name = host?.split(":")[0]?.toLowerCase();
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]";
}

const bearer = (request) => {
  const match = /^Bearer ([A-Za-z0-9_-]{16,256})$/.exec(request.headers.authorization ?? "");
  return match?.[1] ?? null;
};
const sameCapability = (actual, expected) => {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const left = createHash("sha256").update(actual).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
};

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 20_000) throw new SessionBrokerError("request_too_large", "Request body is too large", 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new SessionBrokerError("invalid_json", "Request body must be valid JSON"); }
}

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

async function routeSessionApi(request, response, url, { broker, bootstrapToken }) {
  if (url.pathname === "/api/sessions" && request.method === "POST") {
    if (!sameCapability(bearer(request), bootstrapToken)) throw new SessionBrokerError("access_denied", "Bootstrap capability was rejected", 403);
    sendJson(response, 201, broker.createSession());
    return true;
  }
  const match = /^\/api\/sessions\/(ses_[a-f0-9]{32})\/(events|heartbeat|status)$/.exec(url.pathname);
  if (!match) return false;
  const [, sessionId, operation] = match;
  const token = bearer(request);
  const role = request.headers["x-tutor-role"];
  if (operation === "events" && request.method === "POST") {
    const body = await readJson(request);
    sendJson(response, 201, broker.append({
      sessionId, token, role, messageId: body.message_id, type: body.type, payload: body.payload
    }));
    return true;
  }
  if (operation === "events" && request.method === "GET") {
    const after = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
    const wait = Number.parseInt(url.searchParams.get("wait") ?? "0", 10);
    sendJson(response, 200, wait > 0
      ? await broker.wait({ sessionId, token, role, after, timeoutMs: wait })
      : broker.read({ sessionId, token, role, after }));
    return true;
  }
  if (operation === "heartbeat" && request.method === "POST") {
    sendJson(response, 200, broker.heartbeat({ sessionId, token }));
    return true;
  }
  if (operation === "status" && request.method === "GET") {
    sendJson(response, 200, broker.status({ sessionId, token }));
    return true;
  }
  throw new SessionBrokerError("method_not_allowed", "Method is not allowed for this session route", 405);
}

async function resolveMountedFile(pathname, mounts) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  for (const mount of mounts) {
    if (!decoded.startsWith(mount.prefix)) continue;
    let relative = decoded.slice(mount.prefix.length);
    if (!relative && mount.prefix === "/") relative = "index.html";
    const parts = relative.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) return null;
    const candidate = path.resolve(mount.root, ...parts);
    const rel = path.relative(mount.root, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    try {
      const fileStat = await lstat(candidate);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) return null;
      const canonicalRoot = await realpath(mount.root);
      const canonical = await realpath(candidate);
      const canonicalRel = path.relative(canonicalRoot, canonical);
      if (canonicalRel.startsWith("..") || path.isAbsolute(canonicalRel)) return null;
      return { file: canonical, policy: mount.policy };
    } catch {
      return null;
    }
  }
  return null;
}

export function createHarnessServer({ broker = new TutorSessionBroker(), bootstrapToken = randomBytes(32).toString("base64url"), generatedRoot = DEFAULT_GENERATED_ROOT } = {}) {
  const mounts = mountsFor(generatedRoot);
  return createServer(async (request, response) => {
    try {
      if (!hostAllowed(request.headers.host)) {
        response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Misdirected request");
        return;
      }
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        if (await routeSessionApi(request, response, url, { broker, bootstrapToken })) return;
        throw new SessionBrokerError("unknown_route", "Session route is unavailable", 404);
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
      }
      const mounted = await resolveMountedFile(url.pathname, mounts);
      if (!mounted) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const fileStat = await stat(mounted.file);
      response.writeHead(200, {
        "Content-Type": TYPES.get(path.extname(mounted.file)) ?? "application/octet-stream",
        "Content-Length": fileStat.size,
        "Content-Security-Policy": CSP[mounted.policy],
        "Cross-Origin-Resource-Policy": mounted.policy === "assistant" ? "cross-origin" : "same-origin",
        ...(mounted.policy !== "host" ? { "Access-Control-Allow-Origin": "*" } : {}),
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store"
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(mounted.file).pipe(response);
    } catch (error) {
      if (error instanceof SessionBrokerError) {
        sendJson(response, error.status, { error: error.code });
        return;
      }
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
    }
  });
}

export async function listenHarness({ port = 0, broker = new TutorSessionBroker(), bootstrapToken = randomBytes(32).toString("base64url"), generatedRoot = DEFAULT_GENERATED_ROOT } = {}) {
  const server = createHarnessServer({ broker, bootstrapToken, generatedRoot });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}`, broker, bootstrapToken, generatedRoot: path.resolve(generatedRoot) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = Number.parseInt(process.argv[2] ?? "41739", 10);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error("Port must be an integer from 0 through 65535");
  }
  const { url } = await listenHarness({ port: requestedPort });
  console.log(`Interactive assistant harness listening at ${url}`);
}
