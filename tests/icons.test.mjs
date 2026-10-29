import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
test("every static and dynamic UI icon resolves to a self-hosted Lucide symbol", async () => {
  const sprite = await read("../assets/icons/lucide.svg");
  const source = JSON.parse(await read("../assets/icons/source.json"));
  const symbols = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(
    symbols,
    source.icons.map((i) => i.name),
  );
  const html = await read("../index.html");
  for (const m of html.matchAll(/data-icon="([^"]+)"/g))
    assert.ok(symbols.includes(m[1]), m[1]);
  for (const path of ["../src/app.js", "../src/controls.js"]) {
    for (const m of (await read(path)).matchAll(/icon\("([^"]+)"\)/g))
      assert.ok(symbols.includes(m[1]), m[1]);
  }
  assert.ok(symbols.includes("settings"));
  assert.match(
    await read("../assets/icons/LICENSE"),
    /Lucide Icons and Contributors/,
  );
  assert.doesNotMatch(html, /[←↑→↓↗↶↻＋⚙⋯]/);
});
