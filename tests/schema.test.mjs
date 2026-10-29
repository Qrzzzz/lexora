import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { demoDeck } from "../src/demo.js";
import { validateDeck, parseLegacyJSONL } from "../src/deck.js";
const schema = JSON.parse(
  await readFile(
    new URL("../schemas/deck-v1.schema.json", import.meta.url),
    "utf8",
  ),
);
const validate = new Ajv2020({ allErrors: true }).compile(schema);
test("published schema accepts example and legacy adapter output", async () => {
  const legacy = parseLegacyJSONL(
    await readFile(new URL("../test.jsonl", import.meta.url), "utf8"),
  );
  for (const deck of [demoDeck, legacy])
    assert.equal(validate(deck), true, JSON.stringify(validate.errors));
  const example = JSON.parse(
    await readFile(
      new URL("../examples/notebook.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(example, demoDeck);
});
test("schema and runtime reject common malformed content consistently", () => {
  for (const mutate of [
    (d) => (d.cards[0].answer = " "),
    (d) => (d.schemaVersion = 2),
    (d) => (d.cards[0].type = "html"),
    (d) => (d.cards[0].acceptedAnswers = []),
    (d) => (d.cards[0].id = "__proto__"),
    (d) => (d.cards[0].unexpected = "field"),
    (d) => (d.cards = []),
    (d) => (d.revision = 1.5),
  ]) {
    const deck = structuredClone(demoDeck);
    mutate(deck);
    assert.equal(validate(deck), false);
    assert.throws(() => validateDeck(deck));
  }
});
