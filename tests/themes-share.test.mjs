import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  palettes,
  themeChoices,
  isThemeChoice,
  resolveTheme,
  themeStylesheet,
} from "../src/themes.js";
import {
  createWorkspace,
  validateWorkspace,
  rateCard,
  localDay,
} from "../src/model.js";
import { demoDeck } from "../src/demo.js";
import { todayStudyCount } from "../src/share.js";
import { links } from "../src/config.js";
import { qrRows, qrURL } from "../src/share-qr.js";

test("all palettes provide the same semantic colors and generated CSS stays current", async () => {
  const tokens = Object.keys(palettes.white.tokens).sort();
  for (const [id, palette] of Object.entries(palettes)) {
    assert.deepEqual(Object.keys(palette.tokens).sort(), tokens, id);
    assert.equal(resolveTheme(id, true), id);
  }
  assert.equal(resolveTheme("system", false), "white");
  assert.equal(resolveTheme("system", true), "night");
  assert.equal(
    await readFile(new URL("../src/themes.css", import.meta.url), "utf8"),
    themeStylesheet(),
  );
});
test("registering a palette makes it available to controls, backups and CSS together", () => {
  palettes.testPalette = { ...palettes.white, label: "测试" };
  try {
    assert.equal(isThemeChoice("testPalette"), true);
    assert.ok(themeChoices().some((p) => p.id === "testPalette"));
    assert.match(themeStylesheet(), /body\[data-theme="testPalette"\]/);
    const workspace = createWorkspace(demoDeck);
    workspace.preferences.theme = "testPalette";
    assert.equal(validateWorkspace(workspace).preferences.theme, "testPalette");
  } finally {
    delete palettes.testPalette;
  }
  assert.equal(isThemeChoice("testPalette"), false);
});
test("poster counts today's study events across decks and respects undo snapshots", () => {
  const workspace = createWorkspace(demoDeck),
    date = new Date(2026, 9, 29, 12),
    day = localDay(date);
  workspace.progress[0].daily[day] = 2;
  workspace.progress.push({ daily: { [day]: 7, "2026-10-28": 9 } });
  assert.equal(todayStudyCount(workspace, date), 9);
  const before = structuredClone(workspace);
  rateCard(workspace, "again", date);
  assert.equal(todayStudyCount(workspace, date), 10);
  assert.equal(todayStudyCount(before, date), 9);
  assert.equal(todayStudyCount(createWorkspace(demoDeck), date), 0);
  assert.equal(localDay(new Date(2026, 9, 30, 0, 1)), "2026-10-30");
});
test("bundled poster QR targets the canonical site with a complete square matrix", () => {
  assert.equal(qrURL, links.app);
  assert.ok(qrRows.length >= 21);
  assert.ok(
    qrRows.every((row) => row.length === qrRows.length && /^[01]+$/.test(row)),
  );
});
