import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  themePresets,
  THEME_DEFAULTS,
  generatePalette,
  normalizeHex,
  contrastRatio,
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

test("one seed produces both complete semantic palettes and CSS stays current", async () => {
  const tokens = Object.keys(resolveTheme().tokens).sort();
  for (const [id, preset] of Object.entries(themePresets))
    for (const appearance of ["light", "dark"]) {
      const palette = generatePalette(
        preset.color,
        appearance,
        preset.monochrome,
      );
      assert.deepEqual(Object.keys(palette).sort(), tokens, id);
      assert.notEqual(palette.paper, palette.ink);
    }
  assert.equal(resolveTheme(THEME_DEFAULTS, false).appearance, "light");
  assert.equal(resolveTheme(THEME_DEFAULTS, true).appearance, "dark");
  assert.equal(
    await readFile(new URL("../src/themes.css", import.meta.url), "utf8"),
    themeStylesheet(),
  );
});
test("a new preset needs only a seed and label; backups retain both choices", () => {
  themePresets.testPalette = { color: "#e34b75", label: "测试" };
  try {
    const workspace = createWorkspace(demoDeck);
    workspace.preferences.colorTheme = "testPalette";
    workspace.preferences.appearance = "dark";
    assert.deepEqual(validateWorkspace(workspace), workspace);
    assert.equal(resolveTheme(workspace.preferences).seed, "#e34b75");
  } finally {
    delete themePresets.testPalette;
  }
});

test("text colors remain readable for presets and extreme or arbitrary custom seeds", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5);
  const seeds = [
    ...Object.values(themePresets).map((p) => p.color),
    "#ffffff",
    "#000000",
    "#808080",
    "#ffff00",
    "#00ffff",
    "#ff00ff",
    "#ff0000",
    "#00ff00",
    "#0000ff",
  ];
  let state = 4729;
  for (let i = 0; i < 128; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    seeds.push("#" + (state & 0xffffff).toString(16).padStart(6, "0"));
  }
  for (const seed of seeds)
    for (const appearance of ["light", "dark"]) {
      const tokens = generatePalette(seed, appearance);
      for (const key of [
        "paper",
        "surface",
        "ink",
        "muted",
        "meaning",
        "accent",
        "wash",
      ])
        assert.match(tokens[key], /^#[\da-f]{6}$/);
      for (const background of ["paper", "surface", "wash"])
        for (const [text, min] of [
          ["ink", 7.5],
          ["meaning", 5],
          ["muted", 4.6],
          ["accent", 4.6],
        ])
          assert.ok(
            contrastRatio(tokens[text], tokens[background]) >= min,
            `${seed} ${appearance} ${text}/${background}`,
          );
    }
});
test("monochrome is neutral throughout, including actions and errors", () => {
  for (const appearance of ["light", "dark"]) {
    const tokens = generatePalette("#000000", appearance, true);
    assert.equal(tokens.paper, appearance === "light" ? "#ffffff" : "#000000");
    for (const value of Object.values(tokens)) {
      const channels = value.startsWith("#")
        ? [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)]
        : value.match(/[\d.]+/g).slice(0, 3);
      assert.equal(new Set(channels).size, 1, value);
    }
  }
});
test("mode changes keep the selected seed and custom input normalizes safely", () => {
  assert.equal(normalizeHex("  #F8C "), "#ff88cc");
  for (const value of [
    "red",
    "#12345",
    "#12345678",
    "var(--x)",
    "#fff; color:red",
    {},
    null,
  ])
    assert.equal(normalizeHex(value), null);
  const workspace = createWorkspace(demoDeck);
  workspace.preferences.colorTheme = "custom";
  workspace.preferences.customColor = "#fe2a61";
  assert.equal(
    resolveTheme(workspace.preferences, false).seed,
    resolveTheme(workspace.preferences, true).seed,
  );
  for (const appearance of ["system", "light", "dark"]) {
    workspace.preferences.appearance = appearance;
    assert.deepEqual(validateWorkspace(workspace), workspace);
  }
  workspace.preferences.customColor = "#F8C";
  assert.equal(validateWorkspace(workspace).preferences.customColor, "#ff88cc");
  for (const patch of [
    { customColor: "#fff;background:red" },
    { appearance: "night" },
    { colorTheme: "constructor" },
  ])
    assert.throws(
      () =>
        validateWorkspace({
          ...workspace,
          preferences: { ...workspace.preferences, ...patch },
        }),
      /阅读偏好/,
    );
});
test("legacy themes migrate to independent mode and color without progress loss", () => {
  for (const [theme, appearance] of [
    ["system", "system"],
    ["white", "light"],
    ["night", "dark"],
    ["paper", "system"],
    ["mist", "system"],
  ]) {
    const workspace = createWorkspace(demoDeck);
    rateCard(workspace, "master");
    const old = {
      ...workspace,
      preferences: { theme, motion: true, mode: "recall", order: "source" },
    };
    const restored = validateWorkspace(old);
    assert.equal(restored.preferences.appearance, appearance);
    assert.equal(restored.preferences.colorTheme, "blue");
    assert.ok(!Object.hasOwn(restored.preferences, "theme"));
    assert.deepEqual(restored.progress, workspace.progress);
  }
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
