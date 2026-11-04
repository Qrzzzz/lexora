import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { validateDeck } from "../src/deck.js";
import { presets, loadPreset } from "../src/presets.js";
import {
  createWorkspace,
  importDeck,
  rateCard,
  validateWorkspace,
} from "../src/model.js";
const read = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const { regularPlurals } = await read("../data/sources/systemc/curation.json");
const deck = await read("../examples/systemc-dictionary.json"),
  source = await read("../data/sources/systemc/entries.json");
test("SystemC deck preserves curated spreadsheet pairs and order in schema v2", async () => {
  const validate = new Ajv2020({ allErrors: true }).compile(
    await read("../schemas/deck-v2.schema.json"),
  );
  assert.equal(validate(deck), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateDeck(deck), deck);
  assert.equal(deck.cards.length, 218);
  assert.equal(new Set(deck.cards.map((c) => c.id)).size, 218);
  assert.deepEqual(
    deck.cards.map((c) => ({
      term: c.term,
      definition: c.senses[0].definitions[0],
    })),
    source.entries
      .map((e) => ({
        ...e,
        term: Object.hasOwn(regularPlurals, e.term)
          ? regularPlurals[e.term]
          : e.term,
      }))
      .filter(
        (e, i, all) => all.findIndex((other) => other.term === e.term) === i,
      ),
  );
  assert.ok(
    deck.cards.every(
      (c) =>
        c.shortDefinition.length <= 32 &&
        c.pronunciations.length > 0 &&
        c.senses[0].partOfSpeech !== "未标词性",
    ),
  );
  assert.equal(deck.cards[0].shortDefinition, "缩写");
  assert.equal(deck.cards[0].term, "abbreviation");
  assert.ok(!deck.cards.some((c) => c.term === "arguments"));
  assert.ok(
    deck.cards.find((c) => c.term === "stimulus").note.includes("stimuli"),
  );
  assert.ok(deck.cards.some((c) => c.term === "data"));
  assert.equal(deck.cards.at(-1).term, "WLF");
});
test("second cloud preset loads and keeps its own progress through backup", async () => {
  const preset = presets.find((p) => p.deckId === deck.id);
  assert.equal(preset.count, 218);
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify(deck));
    assert.deepEqual(await loadPreset(preset), deck);
  } finally {
    globalThis.fetch = previous;
  }
  const w = createWorkspace(deck);
  rateCard(w, "master");
  const original = structuredClone(w.progress[0]);
  importDeck(w, await read("../examples/first-dictionary.json"));
  assert.deepEqual(
    w.progress.find((p) => p.deckId === deck.id),
    original,
  );
  assert.deepEqual(validateWorkspace(w), w);
});
