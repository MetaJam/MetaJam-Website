import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".cff": "text/yaml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = path.resolve(root, decoded === "/" ? "index.html" : decoded.slice(1));
  if (!target.startsWith(root + path.sep) && target !== root) {
    return null;
  }
  return target;
}

const server = http.createServer(async (request, response) => {
  const target = safePath(request.url || "/");
  if (!target) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(target);
    const fileTarget = stat.isDirectory() ? path.join(target, "index.html") : target;
    const data = await fs.readFile(fileTarget);
    response.writeHead(200, { "Content-Type": types[path.extname(fileTarget)] || "application/octet-stream" });
    response.end(data);
  } catch {
    try {
      const notFound = await fs.readFile(path.join(root, "404.html"));
      response.writeHead(404, { "Content-Type": types[".html"] });
      response.end(notFound);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  }
});

server.listen(port, () => {
  console.log(`MetaJam docs served at http://127.0.0.1:${port}`);
});
