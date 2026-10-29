import { mkdir, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(root, "output/site");
// The output directory is fixed inside this repository; never use user-provided deletion paths.
if (relative(root, out).startsWith(".."))
  throw Error("Output must stay in repository");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const entry of ["index.html", "src", "assets", "examples", "schemas"])
  await cp(resolve(root, entry), resolve(out, entry), { recursive: true });
await mkdir(resolve(out, "docs"), { recursive: true });
await cp(
  resolve(root, "docs/deck-format.md"),
  resolve(out, "docs/deck-format.md"),
);
console.log("Static site prepared in output/site");
