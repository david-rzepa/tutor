import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

const MOUNTS = [
  { prefix: "/harness/", root: HERE, policy: "module" },
  { prefix: "/packages/teaching-tools/src/", root: path.join(REPO_ROOT, "packages/teaching-tools/src"), policy: "module" },
  { prefix: "/examples/template/", root: path.join(REPO_ROOT, "examples/interactive-assistants/template"), policy: "assistant" },
  { prefix: "/examples/generated/", root: path.join(REPO_ROOT, "examples/interactive-assistants/generated"), policy: "assistant" },
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

async function resolveMountedFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes("\\") || decoded.includes("\0")) return null;
  for (const mount of MOUNTS) {
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

export function createHarnessServer() {
  return createServer(async (request, response) => {
    try {
      if (!hostAllowed(request.headers.host)) {
        response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Misdirected request");
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
      }
      const url = new URL(request.url, "http://127.0.0.1");
      const mounted = await resolveMountedFile(url.pathname);
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
    } catch {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
    }
  });
}

export async function listenHarness({ port = 0 } = {}) {
  const server = createHarnessServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = Number.parseInt(process.argv[2] ?? "41739", 10);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error("Port must be an integer from 0 through 65535");
  }
  const { url } = await listenHarness({ port: requestedPort });
  console.log(`Interactive assistant harness listening at ${url}`);
}
