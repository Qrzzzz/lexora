import { mkdir, cp, rm, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
for (const path of [
  "docs/sample-dictionary.md",
  "docs/deck-format-v1.md",
  "data/NOTICE.md",
  "data/sources/wordtyper-cet4/LICENSE",
  "data/sources/wordtyper-cet4/ECDICT-LICENSE",
  "data/sources/wordtyper-cet4/NOTICE.md",
]) {
  const target = resolve(out, path);
  await mkdir(resolve(target, ".."), { recursive: true });
  await cp(resolve(root, path), target);
}
let commit = process.env.GITHUB_SHA;
if (!commit) {
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    commit = "local";
  }
}
const bytes = await readFile(resolve(root, "examples/first-dictionary.json"));
const sample = JSON.parse(bytes);
await writeFile(
  resolve(out, "build-info.json"),
  JSON.stringify({
    commit,
    builtAt: new Date().toISOString(),
    deckSchema: 2,
    defaultDeck: {
      id: sample.id,
      count: sample.cards.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  }) + "\n",
);
console.log("Static site prepared in output/site");
