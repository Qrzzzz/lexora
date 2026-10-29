import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(
  /[\\/]$/,
  "",
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jsonl": "application/x-ndjson",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".md": "text/plain",
};
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile())
      throw Error();
    res.writeHead(200, {
      "Content-Type":
        (types[extname(file)] || "application/octet-stream") +
        (extname(file) === ".woff2" ? "" : "; charset=utf-8"),
      "Cache-Control": "no-store",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Lexora: http://127.0.0.1:${port}`),
);
