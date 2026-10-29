import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createWorkspace, validateWorkspace } from "../src/model.js";
import { demoDeck } from "../src/demo.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("original supplied word-motion function block and CSS stay byte-for-byte intact", async () => {
  const js = await readFile(
    new URL("../src/original-word-motion.js", import.meta.url),
    "utf8",
  );
  const block = js.split("// BEGIN ORIGINAL\n")[1].split("// END ORIGINAL")[0];
  assert.equal(
    hash(block),
    "eca8d54140c8e0c866b78ff231d305ce73b482322702692ce2a2f2ed8be1f0b3",
  );
  assert.equal(
    hash(
      await readFile(
        new URL("../src/original-word-motion.css", import.meta.url),
      ),
    ),
    "eff66b01cf2117b3020999c2995461cbf972251815953246fc320db0d9e1237e",
  );
});
test("backup preferences preserve progress and retire sound and texture flags", () => {
  const w = createWorkspace(demoDeck);
  delete w.preferences.haptics;
  w.preferences.sound = true;
  w.preferences.texture = true;
  const restored = validateWorkspace(w);
  assert.equal(Object.hasOwn(restored.preferences, "sound"), false);
  assert.equal(Object.hasOwn(restored.preferences, "texture"), false);
  assert.equal(restored.preferences.haptics, true);
  restored.preferences.haptics = false;
  assert.deepEqual(validateWorkspace(restored), restored);
});
test("new readers follow the system; legacy paper palettes migrate without progress loss", () => {
  assert.equal(createWorkspace(demoDeck).preferences.appearance, "system");
  for (const theme of ["paper", "mist"]) {
    const w = createWorkspace(demoDeck);
    w.preferences = { ...w.preferences, theme };
    for (const key of ["appearance", "colorTheme", "customColor"])
      delete w.preferences[key];
    const migrated = validateWorkspace(w);
    assert.equal(migrated.preferences.appearance, "system");
    assert.equal(migrated.preferences.colorTheme, "blue");
    assert.deepEqual(migrated.progress, w.progress);
  }
});
