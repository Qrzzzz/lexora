import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, validateWorkspace, rateCard } from "../src/model.js";
import { demoDeck } from "../src/demo.js";

test("history defaults to a short definition and migrates existing backups without touching progress", () => {
  const workspace = createWorkspace(demoDeck);
  assert.equal(workspace.preferences.historyDisplay, "summary");
  rateCard(workspace, "master");
  delete workspace.preferences.historyDisplay;
  const restored = validateWorkspace(workspace);
  assert.equal(restored.preferences.historyDisplay, "summary");
  assert.deepEqual(restored.progress, workspace.progress);
  assert.deepEqual(restored.decks, workspace.decks);
});

test("both history display choices survive backups; invalid choices are rejected", () => {
  for (const display of ["word", "summary"]) {
    const workspace = createWorkspace(demoDeck);
    workspace.preferences.historyDisplay = display;
    assert.deepEqual(
      validateWorkspace(JSON.parse(JSON.stringify(workspace))),
      workspace,
    );
  }
  for (const value of [null, false, "statuses", {}, ["word"]]) {
    const workspace = createWorkspace(demoDeck);
    workspace.preferences.historyDisplay = value;
    assert.throws(() => validateWorkspace(workspace), /阅读偏好/);
  }
});
