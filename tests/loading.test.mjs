import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sitePoems } from "../src/loading/poems.js";
import { createLoadingPoemPlayer } from "../src/loading/poem-player.js";
import { loadPreset } from "../src/presets.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const hash = (text) => createHash("sha256").update(text).digest("hex");
test("document-site player, styles and 250 poems retain their source content", async () => {
  const source = JSON.parse(await read("../docs/loading-source/source.json"));
  assert.equal(
    hash(await read("../src/loading/poem-player.js")),
    source.runtimeSha256,
  );
  assert.equal(
    hash(await read("../src/loading/original-loading.css")),
    source.cssSha256,
  );
  assert.equal(hash(JSON.stringify(sitePoems)), source.poemsSha256);
  assert.equal(sitePoems.length, 250);
  assert.equal(new Set(sitePoems.map((p) => p.id)).size, 250);
});

test("copied poem player types into reserved geometry and destroys pending work", () => {
  const listeners = new Map(),
    timers = new Map();
  let time = 0,
    next = 0;
  const doc = {
    hidden: false,
    documentElement: { dataset: {} },
    defaultView: {
      matchMedia: () => ({
        matches: false,
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: (type) => listeners.delete(type),
      }),
    },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  const ghost = { textContent: "" },
    output = { textContent: "" };
  const root = {
    ownerDocument: doc,
    dataset: {},
    querySelector: (s) => (s === "[data-poem-ghost]" ? ghost : output),
  };
  const player = createLoadingPoemPlayer({
    root,
    poems: [{ id: "test", lang: "zh-CN", form: "verse", text: "纸上\n微光" }],
    now: () => time,
    schedule: (fn, delay) => {
      const id = ++next;
      timers.set(id, { fn, delay });
      return id;
    },
    cancel: (id) => timers.delete(id),
  });
  player.start();
  assert.equal(ghost.textContent, "纸上\n微光\u00a0_");
  assert.equal(output.textContent, "");
  const [id, task] = timers.entries().next().value;
  timers.delete(id);
  time += task.delay;
  task.fn();
  assert.equal(output.textContent, "纸");
  assert.equal(root.dataset.phase, "typing");
  player.destroy();
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(root.dataset.phase, "idle");
});

test("leaving the initial sample download aborts its request", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    const controller = new AbortController();
    const pending = loadPreset(undefined, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
