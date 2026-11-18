// Tiny static server for the browser demo. Serves ./browser, ./samples and the Transformers.js
// and ONNX Runtime files from node_modules, so no code loads from a CDN.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8080);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOTS = {
  "/vendor/": "node_modules/@huggingface/transformers/dist/",
  "/ort/": "node_modules/onnxruntime-web/dist/",
  "/samples/": "samples/",
  "/": "browser/",
};
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
};

createServer(async (req, res) => {
  let path = new URL(req.url, "http://localhost").pathname;
  if (path === "/") path = "/index.html";

  const prefix = Object.keys(ROOTS).find((p) => path.startsWith(p));
  const relative = normalize(path.slice(prefix.length));
  if (relative.startsWith("..")) {
    res.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(join(HERE, ROOTS[prefix], relative));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
