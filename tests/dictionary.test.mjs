import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import {
  validateDeck,
  cardTerm,
  cardSummary,
  cardDefinition,
  matchesAnswer,
} from "../src/deck.js";
import {
  createWorkspace,
  rateCard,
  activeProgress,
  importDeck,
  validateWorkspace,
} from "../src/model.js";
import { presets, loadPreset } from "../src/presets.js";
const read = async (p) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const schema = await read("../schemas/deck-v2.schema.json");
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const example = await read("../examples/dictionary-v2.json");
const sample = await read("../examples/first-dictionary.json");

test("v2 dictionary schema accepts the entire 3815-word sample and minimal mixed example", () => {
  for (const deck of [sample, example]) {
    assert.equal(validate(deck), true, JSON.stringify(validate.errors));
    assert.deepEqual(validateDeck(deck), deck);
  }
  assert.equal(sample.cards.length, 3815);
  assert.equal(new Set(sample.cards.map((c) => c.id)).size, 3815);
  assert.equal(new Set(sample.cards.map((c) => c.term)).size, 3815);
});
test("short reading definition is separate from complete dictionary senses and spelling", () => {
  const card = example.cards[0];
  assert.equal(cardTerm(card), "record");
  assert.equal(cardSummary(card), "记录；录制");
  assert.ok(cardDefinition(card).includes("唱片"));
  assert.equal(matchesAnswer(card, "RECORD"), true);
  assert.equal(example.cards[1].prompt, "什么是主动回忆？");
});
test("v2 rejects empty or repeated senses, missing parts of speech and examples", () => {
  for (const change of [
    (c) => (c.senses = []),
    (c) => (c.senses[1].id = c.senses[0].id),
    (c) => delete c.senses[0].partOfSpeech,
    (c) => (c.senses[0].definitions = []),
    (c) => (c.shortDefinition = " "),
    (c) => (c.examples = []),
    (c) => (c.pronunciations[0].system = "script"),
  ]) {
    const deck = structuredClone(example);
    change(deck.cards[0]);
    assert.throws(() => validateDeck(deck));
    // Local ID uniqueness requires semantic validation in addition to JSON Schema.
    if (
      new Set(deck.cards[0].senses?.map((s) => s.id)).size ===
      deck.cards[0].senses?.length
    )
      assert.equal(validate(deck), false);
  }
});
test("dictionary content changes reintroduce a mastered term; reading history and backups retain v2", () => {
  const w = createWorkspace(example);
  rateCard(w, "master");
  const update = structuredClone(example);
  update.revision = 2;
  update.cards[0].senses[0].definitions.push("新义项");
  importDeck(w, update);
  assert.equal(activeProgress(w).mastered.length, 0);
  assert.deepEqual(validateWorkspace(w), w);
});
test("sample is complete against the pinned source and preserves pronunciation coverage", async () => {
  const raw = await readFile(
    new URL("../data/sources/wordtyper-cet4/cet4.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    "568b5203eb6b48bdecf8deb8d5ad3bc6546b7960c72e9eafcd877242b6b70105",
  );
  const source = JSON.parse(raw);
  assert.deepEqual(
    sample.cards.map((c) => c.term),
    source.words.map((w) => w.word),
  );
  assert.equal(
    sample.cards.filter((c) => c.pronunciations.length).length,
    3805,
  );
  assert.equal(
    sample.cards.reduce((n, c) => n + c.senses.length, 0),
    8186,
  );
  assert.ok(
    sample.cards.every(
      (c) => c.shortDefinition.length <= 32 && !Object.hasOwn(c, "examples"),
    ),
  );
  assert.equal(sample.cards[0].shortDefinition, "放弃；抛弃；遗弃");
  assert.equal(presets[0].count, sample.cards.length);
  assert.equal(presets[0].deckId, sample.id);
});
test("pronunciations may link to local senses, never to missing senses", () => {
  const deck = structuredClone(example);
  deck.cards[0].pronunciations[0].senseRefs = ["missing"];
  assert.equal(validate(deck), true);
  assert.throws(() => validateDeck(deck), /义组/);
});
test("schema character limits and runtime count Unicode characters consistently", () => {
  const deck = structuredClone(example);
  deck.cards[0].shortDefinition = "🙂".repeat(160);
  assert.equal(validate(deck), true);
  assert.doesNotThrow(() => validateDeck(deck));
  deck.cards[0].shortDefinition += "🙂";
  assert.equal(validate(deck), false);
  assert.throws(() => validateDeck(deck));
});
test("static preset rejects a failed response and mismatched catalogue before import", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("", { status: 404 });
    await assert.rejects(loadPreset(), /无法加载/);
    globalThis.fetch = async () => new Response(JSON.stringify(example));
    await assert.rejects(loadPreset(), /目录不一致/);
    globalThis.fetch = async () => new Response(JSON.stringify(sample));
    assert.equal((await loadPreset()).cards.length, 3815);
  } finally {
    globalThis.fetch = previous;
  }
});
